import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LocalPrivateStorageProvider,
  PrivateImageValidationError,
  type StagedPrivateImage,
} from "../src/lib/private-storage/index.js";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const webp = Buffer.from("RIFF\x04\x00\x00\x00WEBPVP8 ", "binary");

describe("LocalPrivateStorageProvider", () => {
  let temporaryRoot: string;
  let storageRoot: string;
  let provider: LocalPrivateStorageProvider;

  beforeEach(async () => {
    temporaryRoot = await mkdtemp(path.join(tmpdir(), "movencar-private-storage-"));
    storageRoot = path.join(temporaryRoot, "private");
    provider = new LocalPrivateStorageProvider({ root: storageRoot, maxBytes: 1024 });
  });

  afterEach(async () => {
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  const stage = (
    content: Buffer,
    declaredMimeType: string,
    originalFilename: string,
  ) =>
    provider.stage({
      content: Readable.from(split(content)),
      declaredMimeType,
      originalFilename,
    });

  it.each([
    [jpeg, "image/jpeg", "foto.jpeg", "jpg"],
    [png, "image/png", "foto.png", "png"],
    [webp, "image/webp", "foto.webp", "webp"],
  ] as const)(
    "aceita imagem válida %s e detecta seus metadados",
    async (content, mime, filename, extension) => {
      const result = await stage(content, mime, filename);
      expect(result).toMatchObject({
        originalFilename: filename,
        detectedMimeType: mime,
        canonicalExtension: extension,
        size: content.length,
      });
    },
  );

  it("rejeita arquivo vazio e não deixa resíduo", async () => {
    await expect(stage(Buffer.alloc(0), "image/png", "foto.png")).rejects.toMatchObject({
      code: "EMPTY_FILE",
    });
    await expect(stagingEntries()).resolves.toEqual([]);
  });

  it("rejeita MIME declarado falso", async () => {
    await expect(stage(png, "image/jpeg", "foto.png")).rejects.toMatchObject({
      code: "MIME_MISMATCH",
    });
  });

  it("rejeita assinatura de formato não permitido", async () => {
    await expect(
      stage(Buffer.from("GIF89a"), "image/gif", "foto.gif"),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_IMAGE_FORMAT" });
  });

  it("rejeita extensão incompatível sem confiar no nome", async () => {
    await expect(stage(png, "image/png", "foto.exe")).rejects.toMatchObject({
      code: "UNTRUSTED_EXTENSION",
    });
  });

  it("rejeita limite excedido durante streaming e remove o parcial", async () => {
    provider = new LocalPrivateStorageProvider({ root: storageRoot, maxBytes: 9 });
    await expect(stage(Buffer.concat([png, Buffer.alloc(2)]), "image/png", "foto.png"))
      .rejects.toMatchObject({ code: "PHOTO_TOO_LARGE" });
    await expect(stagingEntries()).resolves.toEqual([]);
  });

  it("calcula SHA-256 durante o staging", async () => {
    const result = await stage(png, "image/png", "foto.png");
    expect(result.sha256).toBe(createHash("sha256").update(png).digest("hex"));
  });

  it("gera chaves opacas e aleatórias no backend", async () => {
    const first = await stage(png, "image/png", "mesmo-nome.png");
    const second = await stage(png, "image/png", "mesmo-nome.png");
    expect(first.storageKey).toMatch(/^objects\/[a-f0-9]{2}\/[a-f0-9-]+\.png$/u);
    expect(first.stagingKey).toMatch(/^staging\/[a-f0-9-]+\.tmp$/u);
    expect(first.storageKey).not.toBe(second.storageKey);
    expect(first.storageKey).not.toContain("mesmo-nome");
  });

  it("promove atomicamente, abre e informa stat", async () => {
    const staged = await stage(jpeg, "image/jpeg", "entrada.jpg");
    await provider.promote(staged.stagingKey, staged.storageKey);
    expect(await provider.exists(staged.stagingKey)).toBe(false);
    expect(await provider.exists(staged.storageKey)).toBe(true);
    expect(await provider.stat(staged.storageKey)).toMatchObject({ size: jpeg.length });
    const stream = await provider.open(staged.storageKey);
    expect(await consume(stream)).toEqual(jpeg);
  });

  it("remove arquivo promovido e é idempotente para chave ausente", async () => {
    const staged = await promoteJpeg();
    await provider.remove(staged.storageKey);
    await provider.remove(staged.storageKey);
    expect(await provider.exists(staged.storageKey)).toBe(false);
  });

  it.each(["../fora", "objects/../../fora", "/tmp/fora", "objects\\fora"])(
    "rejeita path traversal na chave %s",
    async (key) => {
      await expect(provider.exists(key)).rejects.toThrow("Chave de storage inválida");
    },
  );

  it("rejeita filename com path malicioso", async () => {
    await expect(stage(png, "image/png", "../../foto.png")).rejects.toBeInstanceOf(
      PrivateImageValidationError,
    );
  });

  it("não segue symlink que tenta escapar da raiz", async () => {
    await provider.exists("objects/inexistente.jpg");
    await symlink(temporaryRoot, path.join(storageRoot, "objects", "escape"));
    await expect(provider.exists("objects/escape/segredo.jpg")).rejects.toThrow(
      "componente inseguro",
    );
  });

  it("não sobrescreve destino existente se promote falhar", async () => {
    const first = await stage(jpeg, "image/jpeg", "primeira.jpg");
    const second = await stage(jpeg, "image/jpeg", "segunda.jpg");
    await provider.promote(first.stagingKey, first.storageKey);
    await expect(provider.promote(second.stagingKey, first.storageKey)).rejects.toMatchObject({
      code: "EEXIST",
    });
    expect(await readFile(path.join(storageRoot, first.storageKey))).toEqual(jpeg);
    expect(await provider.exists(second.stagingKey)).toBe(true);
  });

  it("rejeita raiz configurada dentro de dist ou public", () => {
    expect(
      () =>
        new LocalPrivateStorageProvider({
          root: path.resolve("dist/private"),
          maxBytes: 10,
        }),
    ).toThrow("dist/public");
  });

  async function promoteJpeg(): Promise<StagedPrivateImage> {
    const staged = await stage(jpeg, "image/jpeg", "foto.jpg");
    await provider.promote(staged.stagingKey, staged.storageKey);
    return staged;
  }

  async function stagingEntries(): Promise<string[]> {
    const directory = path.join(storageRoot, "staging");
    return readdir(directory).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
  }
});

function split(content: Buffer): Buffer[] {
  const middle = Math.max(1, Math.floor(content.length / 2));
  return content.length === 0 ? [] : [content.subarray(0, middle), content.subarray(middle)];
}

async function consume(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
