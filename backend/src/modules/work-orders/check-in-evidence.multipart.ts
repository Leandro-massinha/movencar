import Busboy from "busboy";
import type { Request } from "express";
import { ZodError, type ZodType } from "zod";
import { AppError } from "../../lib/errors.js";
import {
  PrivateImageValidationError,
  type PrivateStorageProvider,
  type StagedPrivateImage,
} from "../../lib/private-storage/index.js";
import {
  checkInEvidenceFieldsSchema,
  type CheckInEvidenceFields,
} from "./check-in-evidence.schemas.js";
import {
  damageEvidenceFieldsSchema,
  type DamageEvidenceFields,
} from "./check-in-damage-evidence.schemas.js";

export type ParsedCheckInEvidenceUpload = {
  fields: CheckInEvidenceFields;
  staged: StagedPrivateImage;
};

export async function parseAndStageCheckInEvidence(
  req: Request,
  storage: PrivateStorageProvider,
  maxBytes: number,
): Promise<ParsedCheckInEvidenceUpload> {
  return parseAndStagePrivateEvidence(
    req,
    storage,
    maxBytes,
    new Set(["category", "caption"]),
    checkInEvidenceFieldsSchema,
  );
}

export async function parseAndStageDamageEvidence(
  req: Request,
  storage: PrivateStorageProvider,
  maxBytes: number,
): Promise<{ fields: DamageEvidenceFields; staged: StagedPrivateImage }> {
  return parseAndStagePrivateEvidence(
    req,
    storage,
    maxBytes,
    new Set(["caption"]),
    damageEvidenceFieldsSchema,
  );
}

async function parseAndStagePrivateEvidence<T>(
  req: Request,
  storage: PrivateStorageProvider,
  maxBytes: number,
  allowedFields: ReadonlySet<string>,
  fieldsSchema: ZodType<T>,
): Promise<{ fields: T; staged: StagedPrivateImage }> {
  const contentType = req.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new AppError(
      415,
      "MULTIPART_REQUIRED",
      "Envie a evidência como multipart/form-data.",
    );
  }

  let parser: ReturnType<typeof Busboy>;
  try {
    parser = Busboy({
      headers: req.headers,
      limits: {
        fileSize: maxBytes + 1,
        files: 2,
        fields: 3,
        parts: 5,
        fieldSize: 2_000,
      },
    });
  } catch {
    throw new AppError(
      400,
      "INVALID_MULTIPART",
      "O formulário de envio é inválido.",
    );
  }

  const rawFields: Record<string, string> = {};
  let fileCount = 0;
  let fileLimitReached = false;
  let parsingError: AppError | undefined;
  let stagedPromise: Promise<StagedPrivateImage> | undefined;
  let activeFile: NodeJS.ReadableStream | undefined;
  let interruption: AppError | undefined;
  let cleanupPromise: Promise<void> | undefined;

  const cleanupStaging = () => {
    cleanupPromise ??= (async () => {
      const staged = await stagedPromise?.catch(() => undefined);
      if (staged) await storage.remove(staged.stagingKey).catch(() => undefined);
    })();
    return cleanupPromise;
  };
  const interrupt = (error: AppError) => {
    if (interruption) return;
    interruption = error;
    const destroyable = activeFile as
      | (NodeJS.ReadableStream & { destroy?: (cause?: Error) => void })
      | undefined;
    destroyable?.destroy?.();
    parser.destroy(error);
  };
  const onAborted = () =>
    interrupt(
      new AppError(
        499,
        "UPLOAD_ABORTED",
        "O envio da imagem foi interrompido pelo cliente.",
      ),
    );
  const onRequestError = () =>
    interrupt(
      new AppError(
        400,
        "MULTIPART_STREAM_ERROR",
        "O fluxo de envio da imagem foi interrompido.",
      ),
    );

  parser.on("field", (name, value, info) => {
    if (interruption) return;
    if (
      info.nameTruncated ||
      info.valueTruncated ||
      !allowedFields.has(name) ||
      Object.hasOwn(rawFields, name)
    ) {
      parsingError ??= new AppError(
        400,
        "INVALID_MULTIPART_FIELD",
        "O formulário contém campos inválidos ou duplicados.",
      );
      return;
    }
    rawFields[name] = value;
  });

  parser.on("file", (name, file, info) => {
    if (interruption) {
      file.resume();
      return;
    }
    activeFile = file;
    file.once("close", () => {
      if (activeFile === file) activeFile = undefined;
    });
    fileCount += 1;
    if (name !== "file" || fileCount > 1) {
      parsingError ??= new AppError(
        400,
        "INVALID_FILE_COUNT",
        "Envie exatamente uma imagem por requisição.",
      );
      file.resume();
      return;
    }
    file.on("limit", () => {
      fileLimitReached = true;
    });
    stagedPromise = storage
      .stage({
        content: file,
        declaredMimeType: info.mimeType,
        originalFilename: info.filename,
      })
      .catch((error) => {
        const mapped = mapUploadError(error);
        if (
          mapped instanceof AppError ||
          mapped instanceof ZodError ||
          mapped instanceof PrivateImageValidationError
        )
          throw mapped;
        throw new AppError(
          503,
          "PRIVATE_STORAGE_UNAVAILABLE",
          "O armazenamento privado está temporariamente indisponível.",
        );
      });
    void stagedPromise.catch(() => undefined);
  });

  const parsing = new Promise<void>((resolve, reject) => {
    parser.once("close", resolve);
    parser.once("error", reject);
    parser.once("filesLimit", () => {
      parsingError ??= new AppError(
        400,
        "INVALID_FILE_COUNT",
        "Envie exatamente uma imagem por requisição.",
      );
    });
    parser.once("fieldsLimit", () => {
      parsingError ??= new AppError(
        400,
        "INVALID_MULTIPART_FIELD",
        "O formulário contém campos demais.",
      );
    });
    parser.once("partsLimit", () => {
      parsingError ??= new AppError(
        400,
        "INVALID_MULTIPART",
        "O formulário contém partes demais.",
      );
    });
  });

  req.once("aborted", onAborted);
  req.once("error", onRequestError);
  if (req.aborted) onAborted();
  else req.pipe(parser);

  let staged: StagedPrivateImage | undefined;
  try {
    await parsing;
    if (interruption) throw interruption;
    if (fileCount === 0 || !stagedPromise) {
      throw new AppError(
        400,
        "FILE_REQUIRED",
        "Selecione uma imagem para enviar.",
      );
    }
    staged = await stagedPromise;
    if (interruption || req.aborted) {
      throw (
        interruption ??
        new AppError(
          499,
          "UPLOAD_ABORTED",
          "O envio da imagem foi interrompido pelo cliente.",
        )
      );
    }
    if (fileCount !== 1) {
      throw new AppError(
        400,
        "INVALID_FILE_COUNT",
        "Envie exatamente uma imagem por requisição.",
      );
    }
    if (fileLimitReached || staged.size > maxBytes) {
      throw new AppError(
        413,
        "PHOTO_TOO_LARGE",
        "A imagem excede o limite permitido.",
      );
    }
    if (parsingError) throw parsingError;
    const fields = fieldsSchema.parse(rawFields);
    return { fields, staged };
  } catch (error) {
    if (staged) await storage.remove(staged.stagingKey).catch(() => undefined);
    else await cleanupStaging();
    throw mapUploadError(error);
  } finally {
    req.off("aborted", onAborted);
    req.off("error", onRequestError);
  }
}

function mapUploadError(error: unknown): unknown {
  if (error instanceof AppError || error instanceof ZodError) return error;
  if (!(error instanceof PrivateImageValidationError)) return error;
  const errors: Record<string, [number, string]> = {
    EMPTY_FILE: [400, "O arquivo está vazio."],
    MIME_MISMATCH: [415, "O tipo informado não corresponde à imagem."],
    UNSUPPORTED_IMAGE_FORMAT: [415, "O formato da imagem não é permitido."],
    UNTRUSTED_EXTENSION: [415, "A extensão não corresponde à imagem."],
    INVALID_FILENAME: [400, "O nome original do arquivo é inválido."],
    PHOTO_TOO_LARGE: [413, "A imagem excede o limite permitido."],
  };
  const [status, message] = errors[error.code] ?? [400, "Imagem inválida."];
  return new AppError(status, error.code, message);
}
