import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import type { Request } from "express";
import { PassThrough } from "node:stream";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { errorHandler } from "../src/lib/errors.js";
import { LocalPrivateStorageProvider } from "../src/lib/private-storage/index.js";
import {
  parseAndStageCheckInEvidence,
  parseAndStageDamageEvidence,
  parseAndStageChecklistItemEvidence,
} from "../src/modules/work-orders/check-in-evidence.multipart.js";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const webp = Buffer.from("RIFF\x04\x00\x00\x00WEBPVP8 ", "binary");

describe("multipart de evidências gerais do Check-in", () => {
  let temporaryRoot: string;
  let storage: LocalPrivateStorageProvider;
  let app: express.Express;
  let maxBytes: number;

  beforeEach(async () => {
    temporaryRoot = await mkdtemp(path.join(tmpdir(), "movencar-evidence-upload-"));
    maxBytes = 100;
    storage = new LocalPrivateStorageProvider({ root: temporaryRoot, maxBytes });
    app = express();
    app.post("/upload", async (req, res, next) => {
      try {
        const result = await parseAndStageCheckInEvidence(
          req,
          storage,
          maxBytes,
        );
        res.status(201).json({ fields: result.fields, staged: result.staged });
      } catch (error) {
        next(error);
      }
    });
    app.use(errorHandler);
  });

  afterEach(async () => {
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  it.each([
    ["JPEG", jpeg, "image/jpeg", "foto.jpg", "jpg"],
    ["PNG", png, "image/png", "foto.png", "png"],
    ["WebP", webp, "image/webp", "foto.webp", "webp"],
  ] as const)(
    "processa %s em streaming pela validação da Fase 1",
    async (_label, content, mime, filename, extension) => {
      const response = await request(app)
        .post("/upload")
        .field("category", "FRONT")
        .field("caption", "Vista dianteira")
        .attach("file", content, { filename, contentType: mime })
        .expect(201);
      expect(response.body).toMatchObject({
        fields: { category: "FRONT", caption: "Vista dianteira" },
        staged: {
          originalFilename: filename,
          declaredMimeType: mime,
          detectedMimeType: mime,
          canonicalExtension: extension,
          size: content.length,
        },
      });
      expect(response.body.staged).not.toHaveProperty("companyId");
      await storage.remove(response.body.staged.stagingKey);
    },
  );

  it("rejeita requisição sem arquivo", async () => {
    await request(app)
      .post("/upload")
      .field("category", "FRONT")
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("FILE_REQUIRED"));
  });

  it("rejeita mais de um arquivo e limpa o primeiro staging", async () => {
    await request(app)
      .post("/upload")
      .field("category", "FRONT")
      .attach("file", jpeg, { filename: "um.jpg", contentType: "image/jpeg" })
      .attach("file", jpeg, { filename: "dois.jpg", contentType: "image/jpeg" })
      .expect(400)
      .expect(({ body }) =>
        expect(body.error.code).toBe("INVALID_FILE_COUNT"),
      );
    expect(await stagedFiles()).toEqual([]);
  });

  it("rejeita companyId e qualquer campo inesperado", async () => {
    await request(app)
      .post("/upload")
      .field("category", "FRONT")
      .field("companyId", "00000000-0000-4000-8000-000000000000")
      .attach("file", jpeg, { filename: "foto.jpg", contentType: "image/jpeg" })
      .expect(400)
      .expect(({ body }) =>
        expect(body.error.code).toBe("INVALID_MULTIPART_FIELD"),
      );
    expect(await stagedFiles()).toEqual([]);
  });

  it.each([
    ["MIME falso", png, "image/jpeg", "foto.png", "MIME_MISMATCH", 415],
    [
      "formato não permitido",
      Buffer.from("GIF89a"),
      "image/gif",
      "foto.gif",
      "UNSUPPORTED_IMAGE_FORMAT",
      415,
    ],
    ["arquivo vazio", Buffer.alloc(0), "image/png", "foto.png", "EMPTY_FILE", 400],
  ] as const)(
    "rejeita %s",
    async (_label, content, mime, filename, code, status) => {
      await request(app)
        .post("/upload")
        .field("category", "FRONT")
        .attach("file", content, { filename, contentType: mime })
        .expect(status)
        .expect(({ body }) => expect(body.error.code).toBe(code));
      expect(await stagedFiles()).toEqual([]);
    },
  );

  it("rejeita arquivo acima do limite", async () => {
    maxBytes = png.length;
    storage = new LocalPrivateStorageProvider({ root: temporaryRoot, maxBytes });
    await request(app)
      .post("/upload")
      .field("category", "FRONT")
      .attach("file", Buffer.concat([png, Buffer.from([1])]), {
        filename: "foto.png",
        contentType: "image/png",
      })
      .expect(413)
      .expect(({ body }) => expect(body.error.code).toBe("PHOTO_TOO_LARGE"));
    expect(await stagedFiles()).toEqual([]);
  });

  it("rejeita categoria inválida e limpa staging", async () => {
    await request(app)
      .post("/upload")
      .field("category", "INVALID")
      .attach("file", jpeg, { filename: "foto.jpg", contentType: "image/jpeg" })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));
    expect(await stagedFiles()).toEqual([]);
  });

  it("exige multipart/form-data", async () => {
    await request(app)
      .post("/upload")
      .send({ category: "FRONT" })
      .expect(415)
      .expect(({ body }) => expect(body.error.code).toBe("MULTIPART_REQUIRED"));
  });

  it("interrompe upload abortado após alguns chunks e remove parcial", async () => {
    const controlled = controlledMultipartRequest();
    const upload = parseAndStageCheckInEvidence(
      controlled.req,
      storage,
      maxBytes,
    );
    controlled.stream.write(controlled.prefix);
    controlled.stream.write(jpeg.subarray(0, 4));
    await nextTurn();
    controlled.abort();
    await expect(upload).rejects.toMatchObject({ code: "UPLOAD_ABORTED" });
    expect(await stagedFiles()).toEqual([]);
  });

  it("resolve corrida de abort próximo ao final sem staging órfão", async () => {
    const controlled = controlledMultipartRequest();
    const upload = parseAndStageCheckInEvidence(
      controlled.req,
      storage,
      maxBytes,
    );
    controlled.stream.write(controlled.prefix);
    controlled.stream.write(jpeg);
    controlled.stream.write("\r\n--movencar-boundary--");
    controlled.abort();
    await expect(upload).rejects.toMatchObject({ code: "UPLOAD_ABORTED" });
    expect(await stagedFiles()).toEqual([]);
  });

  it("compensa erro do stream e encerra a promise", async () => {
    const controlled = controlledMultipartRequest();
    const upload = parseAndStageCheckInEvidence(
      controlled.req,
      storage,
      maxBytes,
    );
    controlled.stream.write(controlled.prefix);
    controlled.stream.write(jpeg.subarray(0, 4));
    await nextTurn();
    controlled.fail();
    await expect(upload).rejects.toMatchObject({
      code: "MULTIPART_STREAM_ERROR",
    });
    expect(await stagedFiles()).toEqual([]);
  });

  async function stagedFiles() {
    return readdir(path.join(temporaryRoot, "staging")).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return [];
        throw error;
      },
    );
  }
});

describe("multipart de evidências de avaria", () => {
  let temporaryRoot: string;
  let storage: LocalPrivateStorageProvider;
  let app: express.Express;

  beforeEach(async () => {
    temporaryRoot = await mkdtemp(path.join(tmpdir(), "movencar-damage-upload-"));
    storage = new LocalPrivateStorageProvider({ root: temporaryRoot, maxBytes: 100 });
    app = express();
    app.post("/upload", async (req, res, next) => {
      try {
        const result = await parseAndStageDamageEvidence(req, storage, 100);
        res.status(201).json({ fields: result.fields, staged: result.staged });
      } catch (error) {
        next(error);
      }
    });
    app.use(errorHandler);
  });

  afterEach(async () => {
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  it.each([
    ["JPEG", jpeg, "image/jpeg", "avaria.jpg", "jpg"],
    ["PNG", png, "image/png", "avaria.png", "png"],
    ["WebP", webp, "image/webp", "avaria.webp", "webp"],
  ] as const)("aceita %s e somente caption", async (_label, content, mime, filename, extension) => {
    const response = await request(app)
      .post("/upload")
      .field("caption", "Risco no para-choque")
      .attach("file", content, { filename, contentType: mime })
      .expect(201);
    expect(response.body).toMatchObject({
      fields: { caption: "Risco no para-choque" },
      staged: { detectedMimeType: mime, canonicalExtension: extension },
    });
    await storage.remove(response.body.staged.stagingKey);
  });

  it.each(["companyId", "category"])("rejeita campo proibido %s e limpa staging", async (field) => {
    await request(app)
      .post("/upload")
      .field(field, "FRONT")
      .attach("file", jpeg, { filename: "avaria.jpg", contentType: "image/jpeg" })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("INVALID_MULTIPART_FIELD"));
    const files = await readdir(path.join(temporaryRoot, "staging")).catch(() => []);
    expect(files).toEqual([]);
  });
});

describe("multipart de evidências de item da Lista de Verificação", () => {
  it("reutiliza o pipeline e aceita somente legenda", async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "movencar-item-upload-"));
    const storage = new LocalPrivateStorageProvider({ root: temporaryRoot, maxBytes: 100 });
    const app = express();
    app.post("/upload", async (req, res, next) => {
      try { res.status(201).json(await parseAndStageChecklistItemEvidence(req, storage, 100)); }
      catch (error) { next(error); }
    });
    app.use(errorHandler);
    const response = await request(app).post("/upload").field("caption", "Freio dianteiro")
      .attach("file", jpeg, { filename: "freio.jpg", contentType: "image/jpeg" }).expect(201);
    expect(response.body.fields).toEqual({ caption: "Freio dianteiro" });
    await storage.remove(response.body.staged.stagingKey);
    await request(app).post("/upload").field("companyId", "indevido")
      .attach("file", jpeg, { filename: "freio.jpg", contentType: "image/jpeg" }).expect(400);
    await rm(temporaryRoot, { recursive: true, force: true });
  });
});

function controlledMultipartRequest() {
  const boundary = "movencar-boundary";
  const stream = new PassThrough();
  Object.defineProperty(stream, "aborted", {
    configurable: true,
    writable: true,
    value: false,
  });
  Object.assign(stream, {
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    get(name: string) {
      return name.toLowerCase() === "content-type"
        ? this.headers["content-type"]
        : undefined;
    },
  });
  const prefix = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="category"\r\n\r\nFRONT\r\n`,
    ),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="foto.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
    ),
  ]);
  return {
    req: stream as unknown as Request,
    stream,
    prefix,
    abort() {
      (stream as PassThrough & { aborted: boolean }).aborted = true;
      stream.emit("aborted");
    },
    fail() {
      stream.emit("error", new Error("erro de transporte simulado"));
    },
  };
}

const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve));
