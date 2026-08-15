import type { Readable } from "node:stream";

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export type StageImageInput = {
  content: NodeJS.ReadableStream | AsyncIterable<Uint8Array>;
  declaredMimeType: string;
  originalFilename: string;
};

export type StagedPrivateImage = {
  stagingKey: string;
  storageKey: string;
  originalFilename: string;
  declaredMimeType: string;
  detectedMimeType: AllowedImageMimeType;
  canonicalExtension: "jpg" | "png" | "webp";
  size: number;
  sha256: string;
};

export type PrivateStorageStat = {
  size: number;
  modifiedAt: Date;
};

export interface PrivateStorageProvider {
  stage(input: StageImageInput): Promise<StagedPrivateImage>;
  promote(stagingKey: string, storageKey: string): Promise<void>;
  open(storageKey: string): Promise<Readable>;
  stat(storageKey: string): Promise<PrivateStorageStat>;
  remove(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
}
