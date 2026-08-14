import path from "node:path";
import type { AllowedImageMimeType } from "./private-storage.types.js";

export class PrivateImageValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "PrivateImageValidationError";
  }
}

type DetectedImage = {
  mimeType: AllowedImageMimeType;
  extension: "jpg" | "png" | "webp";
};

const extensionByMime: Record<AllowedImageMimeType, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

export function sanitizeOriginalFilename(filename: string): string {
  const normalized = filename.normalize("NFKC").trim();
  if (
    !normalized ||
    normalized === "." ||
    normalized === ".." ||
    hasControlCharacter(normalized) ||
    normalized !== path.basename(normalized) ||
    normalized.includes("/") ||
    normalized.includes("\\")
  ) {
    throw new PrivateImageValidationError(
      "INVALID_FILENAME",
      "Nome de arquivo inválido.",
    );
  }

  return normalized.slice(0, 255);
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

export function detectSupportedImage(header: Uint8Array): DetectedImage | null {
  if (
    header.length >= 3 &&
    header[0] === 0xff &&
    header[1] === 0xd8 &&
    header[2] === 0xff
  ) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  ) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (
    header.length >= 12 &&
    Buffer.from(header.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(header.subarray(8, 12)).toString("ascii") === "WEBP"
  ) {
    return { mimeType: "image/webp", extension: "webp" };
  }
  return null;
}

export function validateImageIdentity(
  header: Uint8Array,
  declaredMimeType: string,
  originalFilename: string,
): DetectedImage {
  const detected = detectSupportedImage(header);
  if (!detected) {
    throw new PrivateImageValidationError(
      "UNSUPPORTED_IMAGE_FORMAT",
      "Formato de imagem não permitido ou assinatura inválida.",
    );
  }
  if (declaredMimeType.trim().toLowerCase() !== detected.mimeType) {
    throw new PrivateImageValidationError(
      "MIME_MISMATCH",
      "O tipo MIME declarado não corresponde ao conteúdo.",
    );
  }

  const extension = path.extname(originalFilename).slice(1).toLowerCase();
  if (!extension || !extensionByMime[detected.mimeType].includes(extension)) {
    throw new PrivateImageValidationError(
      "UNTRUSTED_EXTENSION",
      "A extensão do arquivo não corresponde ao conteúdo.",
    );
  }
  return detected;
}
