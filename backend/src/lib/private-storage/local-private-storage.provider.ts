import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  constants,
  createWriteStream,
  type ReadStream,
} from "node:fs";
import {
  chmod,
  lstat,
  link,
  mkdir,
  open as openFile,
  realpath,
  rename,
  rm,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import {
  PrivateImageValidationError,
  sanitizeOriginalFilename,
  validateImageIdentity,
} from "./image-validation.js";
import type {
  PrivateStorageProvider,
  PrivateStorageStat,
  StageImageInput,
  StagedPrivateImage,
} from "./private-storage.types.js";

const HEADER_BYTES = 16;
const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

export type LocalPrivateStorageOptions = {
  root: string;
  maxBytes: number;
  forbiddenRoots?: string[];
};

export class LocalPrivateStorageProvider implements PrivateStorageProvider {
  private readonly configuredRoot: string;
  private readonly maxBytes: number;
  private root = "";
  private stagingRoot = "";
  private objectsRoot = "";
  private initialization?: Promise<void>;

  constructor(options: LocalPrivateStorageOptions) {
    if (!path.isAbsolute(options.root)) {
      throw new Error("A raiz do storage privado deve ser um caminho absoluto.");
    }
    if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) {
      throw new Error("O limite de tamanho deve ser um inteiro positivo.");
    }
    this.configuredRoot = path.resolve(options.root);
    this.maxBytes = options.maxBytes;

    const forbidden = options.forbiddenRoots ?? [
      path.resolve(process.cwd(), "dist"),
      path.resolve(process.cwd(), "public"),
    ];
    if (
      forbidden.some((entry) => {
        const forbiddenRoot = path.resolve(entry);
        return (
          this.configuredRoot === forbiddenRoot ||
          isWithin(forbiddenRoot, this.configuredRoot)
        );
      })
    ) {
      throw new Error("A raiz do storage privado não pode ficar em dist/public.");
    }
  }

  async stage(input: StageImageInput): Promise<StagedPrivateImage> {
    await this.initialize();
    const originalFilename = sanitizeOriginalFilename(input.originalFilename);
    const token = `${randomUUID()}-${randomBytes(12).toString("hex")}`;
    const stagingKey = `staging/${token}.tmp`;
    const stagingPath = await this.resolveKey(stagingKey, "staging");
    const temporaryPath = `${stagingPath}.writing`;
    const hash = createHash("sha256");
    let size = 0;
    let tooLarge = false;
    let header = Buffer.alloc(0);
    let stream: ReturnType<typeof createWriteStream> | undefined;

    try {
      stream = createWriteStream(temporaryPath, {
        flags: "wx",
        mode: PRIVATE_FILE_MODE,
      });
      for await (const rawChunk of input.content) {
        const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
        if (chunk.length === 0) continue;
        size += chunk.length;
        if (size > this.maxBytes) {
          tooLarge = true;
          continue;
        }
        if (header.length < HEADER_BYTES) {
          header = Buffer.concat([header, chunk.subarray(0, HEADER_BYTES - header.length)]);
        }
        hash.update(chunk);
        if (!stream.write(chunk)) await once(stream, "drain");
      }
      if (size === 0) {
        throw new PrivateImageValidationError("EMPTY_FILE", "O arquivo está vazio.");
      }
      stream.end();
      await once(stream, "close");
      stream = undefined;
      if (tooLarge) {
        throw new PrivateImageValidationError(
          "PHOTO_TOO_LARGE",
          "A imagem excede o limite permitido.",
        );
      }

      const detected = validateImageIdentity(
        header,
        input.declaredMimeType,
        originalFilename,
      );
      const storageKey = `objects/${token.slice(0, 2)}/${token}.${detected.extension}`;
      await rename(temporaryPath, stagingPath);
      await chmod(stagingPath, PRIVATE_FILE_MODE);
      return {
        stagingKey,
        storageKey,
        originalFilename,
        declaredMimeType: input.declaredMimeType.trim().toLowerCase(),
        detectedMimeType: detected.mimeType,
        canonicalExtension: detected.extension,
        size,
        sha256: hash.digest("hex"),
      };
    } catch (error) {
      stream?.destroy();
      await rm(temporaryPath, { force: true });
      await rm(stagingPath, { force: true });
      throw error;
    }
  }

  async promote(stagingKey: string, storageKey: string): Promise<void> {
    await this.initialize();
    const source = await this.resolveKey(stagingKey, "staging");
    const destination = await this.resolveKey(storageKey, "objects", true);
    const sourceStat = await lstat(source);
    if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
      throw new Error("O item em staging não é um arquivo regular.");
    }

    await mkdir(path.dirname(destination), {
      recursive: true,
      mode: PRIVATE_DIRECTORY_MODE,
    });
    await this.assertSafeDirectory(path.dirname(destination), this.objectsRoot);
    // link() publica atomicamente e falha se a chave já existir; staging e objects
    // pertencem à mesma raiz/filesystem. O unlink posterior conclui a promoção.
    await link(source, destination);
    try {
      await chmod(destination, PRIVATE_FILE_MODE);
      await unlink(source);
    } catch (error) {
      await rm(destination, { force: true });
      throw error;
    }
  }

  async open(storageKey: string): Promise<ReadStream> {
    await this.initialize();
    const target = await this.resolveKey(storageKey);
    const handle = await openFile(
      target,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
    );
    const info = await handle.stat();
    if (!info.isFile()) {
      await handle.close();
      throw new Error("A chave não aponta para um arquivo regular.");
    }
    return handle.createReadStream({ autoClose: true });
  }

  async stat(storageKey: string): Promise<PrivateStorageStat> {
    await this.initialize();
    const target = await this.resolveKey(storageKey);
    const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error("A chave não aponta para um arquivo regular.");
    }
    return { size: info.size, modifiedAt: info.mtime };
  }

  async remove(storageKey: string): Promise<void> {
    await this.initialize();
    const target = await this.resolveKey(storageKey);
    const info = await lstat(target).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!info) return;
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error("A chave não aponta para um arquivo regular.");
    }
    await unlink(target);
  }

  async exists(storageKey: string): Promise<boolean> {
    await this.initialize();
    const target = await this.resolveKey(storageKey);
    try {
      const info = await lstat(target);
      return info.isFile() && !info.isSymbolicLink();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  private async initialize(): Promise<void> {
    this.initialization ??= this.initializeOnce();
    return this.initialization;
  }

  private async initializeOnce(): Promise<void> {
    await mkdir(this.configuredRoot, {
      recursive: true,
      mode: PRIVATE_DIRECTORY_MODE,
    });
    this.root = await realpath(this.configuredRoot);
    this.stagingRoot = path.join(this.root, "staging");
    this.objectsRoot = path.join(this.root, "objects");
    await mkdir(this.stagingRoot, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
    await mkdir(this.objectsRoot, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
    await this.assertSafeDirectory(this.stagingRoot, this.root);
    await this.assertSafeDirectory(this.objectsRoot, this.root);
    await chmod(this.root, PRIVATE_DIRECTORY_MODE);
    await chmod(this.stagingRoot, PRIVATE_DIRECTORY_MODE);
    await chmod(this.objectsRoot, PRIVATE_DIRECTORY_MODE);
  }

  private async resolveKey(
    key: string,
    requiredArea?: "staging" | "objects",
    allowMissingParents = false,
  ): Promise<string> {
    if (
      !key ||
      path.isAbsolute(key) ||
      key.includes("\\") ||
      key.includes("\0") ||
      key.split("/").some((part) => !part || part === "." || part === "..")
    ) {
      throw new Error("Chave de storage inválida.");
    }
    if (requiredArea && !key.startsWith(`${requiredArea}/`)) {
      throw new Error("Chave incompatível com a operação.");
    }
    if (!key.startsWith("staging/") && !key.startsWith("objects/")) {
      throw new Error("Área de storage inválida.");
    }
    const target = path.resolve(this.root, ...key.split("/"));
    if (!isWithin(this.root, target) || target === this.root) {
      throw new Error("Tentativa de escapar da raiz do storage.");
    }
    const parent = allowMissingParents
      ? requiredArea === "objects"
        ? this.objectsRoot
        : this.stagingRoot
      : path.dirname(target);
    await this.assertSafeExistingAncestors(parent);
    return target;
  }

  private async assertSafeExistingAncestors(target: string): Promise<void> {
    let current = target;
    while (isWithin(this.root, current) && current !== this.root) {
      try {
        const info = await lstat(current);
        if (info.isSymbolicLink() || !info.isDirectory()) {
          throw new Error("O caminho do storage contém componente inseguro.");
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      current = path.dirname(current);
    }
  }

  private async assertSafeDirectory(target: string, expectedParent: string): Promise<void> {
    const resolved = await realpath(target);
    if (!isWithin(expectedParent, resolved) && resolved !== expectedParent) {
      throw new Error("Diretório do storage escapou da raiz esperada.");
    }
    const info = await lstat(target);
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error("Diretório do storage é inseguro.");
    }
  }
}

function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}
