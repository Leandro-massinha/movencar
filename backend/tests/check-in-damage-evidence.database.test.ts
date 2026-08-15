import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalPrivateStorageProvider } from "../src/lib/private-storage/index.js";
import { prisma } from "../src/lib/prisma.js";
import {
  createDamageEvidence,
  deleteDamageEvidence,
  getDamageEvidenceContent,
  listDamageEvidence,
  MAX_DAMAGE_EVIDENCE,
  openDamageEvidenceContent,
} from "../src/modules/work-orders/check-in-damage-evidence.service.js";
import type { WorkOrderActor } from "../src/modules/work-orders/work-orders.service.js";

const suite = process.env.CHECK_IN_DAMAGE_EVIDENCE_DATABASE_TESTS === "1" ? describe : describe.skip;
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

suite("evidências privadas vinculadas à avaria no PostgreSQL", () => {
  const companyAId = randomUUID();
  const companyBId = randomUUID();
  const branchAId = randomUUID();
  const branchBId = randomUUID();
  const userAId = randomUUID();
  const userBId = randomUUID();
  const actorA: WorkOrderActor = { companyId: companyAId, branchId: branchAId, userId: userAId };
  let root: string;
  let storage: LocalPrivateStorageProvider;
  let orderNumber = 7000;

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "movencar-damage-evidence-db-"));
    storage = new LocalPrivateStorageProvider({ root, maxBytes: 1024 });
    await createTenant("A", companyAId, branchAId, userAId);
    await createTenant("B", companyBId, branchBId, userBId);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await rm(root, { recursive: true, force: true });
  });

  it("cria vínculo, asset AVAILABLE, sequência, DTO público e auditoria", async () => {
    const context = await createContext(companyAId, branchAId, userAId);
    const evidence = await createDamageEvidence(actorA, context.workOrderId, context.damageId,
      { caption: "Risco lateral" }, await stage("risco.jpg"), storage);
    expect(evidence).toMatchObject({ caption: "Risco lateral", sequence: 1, uploader: { id: userAId } });
    expect(evidence).not.toHaveProperty("companyId");
    expect(evidence).not.toHaveProperty("storageKey");
    const row = await prisma.checkInDamageEvidenceAttachment.findUniqueOrThrow({
      where: { id: evidence.id }, include: { fileAsset: true },
    });
    expect(row).toMatchObject({ damageId: context.damageId, checkInId: context.checkInId });
    expect(row.fileAsset).toMatchObject({ status: "AVAILABLE", ownershipType: "CHECK_IN_DAMAGE" });
    expect(await prisma.auditLog.count({ where: { entityId: evidence.id, action: "DAMAGE_EVIDENCE_UPLOAD" } })).toBe(1);
  });

  it("numera por avaria e serializa uploads simultâneos", async () => {
    const context = await createContext(companyAId, branchAId, userAId);
    const [one, two] = await Promise.all([stage("um.jpg"), stage("dois.jpg")]);
    const rows = await Promise.all([
      createDamageEvidence(actorA, context.workOrderId, context.damageId, {}, one, storage),
      createDamageEvidence(actorA, context.workOrderId, context.damageId, {}, two, storage),
    ]);
    expect(rows.map((row) => row.sequence).sort()).toEqual([1, 2]);
    const otherDamage = await createDamage(context, companyAId, userAId);
    const independent = await createDamageEvidence(actorA, context.workOrderId, otherDamage.id, {}, await stage("outra.jpg"), storage);
    expect(independent.sequence).toBe(1);
  });

  it("isola tenant e impede usar avaria de outro check-in", async () => {
    const a = await createContext(companyAId, branchAId, userAId);
    const b = await createContext(companyBId, branchBId, userBId);
    const evidence = await createDamageEvidence(actorA, a.workOrderId, a.damageId, {}, await stage("tenant.jpg"), storage);
    await expect(listDamageEvidence(companyBId, b.workOrderId, a.damageId)).rejects.toMatchObject({ status: 404 });
    await expect(getDamageEvidenceContent(companyBId, b.workOrderId, b.damageId, evidence.id)).rejects.toMatchObject({ status: 404 });
    await expect(createDamageEvidence(actorA, a.workOrderId, b.damageId, {}, await stage("cruzada.jpg"), storage)).rejects.toMatchObject({ code: "CHECK_IN_DAMAGE_NOT_FOUND" });
    await expect(
      createDamageEvidence(
        actorA,
        a.workOrderId,
        randomUUID(),
        {},
        await stage("inexistente.jpg"),
        storage,
      ),
    ).rejects.toMatchObject({ code: "CHECK_IN_DAMAGE_NOT_FOUND" });
  });

  it("permite leitura após conclusão e bloqueia mutações", async () => {
    const context = await createContext(companyAId, branchAId, userAId);
    const evidence = await createDamageEvidence(actorA, context.workOrderId, context.damageId, {}, await stage("final.jpg"), storage);
    await prisma.vehicleCheckIn.update({ where: { id: context.checkInId }, data: { status: "COMPLETED", completedAt: new Date() } });
    expect(await listDamageEvidence(companyAId, context.workOrderId, context.damageId)).toHaveLength(1);
    expect(await consume((await openDamageEvidenceContent(companyAId, context.workOrderId, context.damageId, evidence.id, storage)).stream)).toEqual(jpeg);
    await expect(createDamageEvidence(actorA, context.workOrderId, context.damageId, {}, await stage("tardia.jpg"), storage)).rejects.toMatchObject({ code: "CHECK_IN_NOT_EDITABLE" });
    await expect(deleteDamageEvidence(actorA, context.workOrderId, context.damageId, evidence.id)).rejects.toMatchObject({ code: "CHECK_IN_NOT_EDITABLE" });
  });

  it("faz soft delete, preserva arquivo físico e não reutiliza sequência", async () => {
    const context = await createContext(companyAId, branchAId, userAId);
    const staged = await stage("remover.jpg");
    const evidence = await createDamageEvidence(actorA, context.workOrderId, context.damageId, {}, staged, storage);
    await deleteDamageEvidence(actorA, context.workOrderId, context.damageId, evidence.id);
    expect(await listDamageEvidence(companyAId, context.workOrderId, context.damageId)).toEqual([]);
    await expect(
      getDamageEvidenceContent(
        companyAId,
        context.workOrderId,
        context.damageId,
        evidence.id,
      ),
    ).rejects.toMatchObject({ code: "DAMAGE_EVIDENCE_NOT_FOUND" });
    expect(await storage.exists(staged.storageKey)).toBe(true);
    const deleted = await prisma.checkInDamageEvidenceAttachment.findUniqueOrThrow({ where: { id: evidence.id }, include: { fileAsset: true } });
    expect(deleted.deletedAt).toBeInstanceOf(Date);
    expect(deleted.fileAsset.status).toBe("DELETED");
    expect(
      await prisma.auditLog.count({
        where: {
          entityId: evidence.id,
          action: "DAMAGE_EVIDENCE_DELETE",
        },
      }),
    ).toBe(1);
    const next = await createDamageEvidence(actorA, context.workOrderId, context.damageId, {}, await stage("seguinte.jpg"), storage);
    expect(next.sequence).toBe(2);
  });

  it("compensa promoção/transação e aplica limite de 20 por avaria", async () => {
    const failedContext = await createContext(companyAId, branchAId, userAId);
    const failed = await stage("falha.jpg");
    const failingStorage = { ...storage, stage: storage.stage.bind(storage), open: storage.open.bind(storage), stat: storage.stat.bind(storage), remove: storage.remove.bind(storage), exists: storage.exists.bind(storage), promote: async () => { throw new Error("falha"); } };
    await expect(createDamageEvidence(actorA, failedContext.workOrderId, failedContext.damageId, {}, failed, failingStorage)).rejects.toMatchObject({ code: "PRIVATE_STORAGE_PROMOTION_FAILED" });
    expect(await prisma.fileAsset.findUnique({ where: { storageKey: failed.storageKey } })).toMatchObject({ status: "FAILED" });

    const context = await createContext(companyAId, branchAId, userAId);
    const assets = Array.from({ length: MAX_DAMAGE_EVIDENCE }, (_, index) => ({ id: randomUUID(), index }));
    await prisma.fileAsset.createMany({ data: assets.map(({ id }) => assetData(id, companyAId, userAId)) });
    await prisma.checkInDamageEvidenceAttachment.createMany({ data: assets.map(({ id, index }) => ({ companyId: companyAId, checkInId: context.checkInId, damageId: context.damageId, fileAssetId: id, sequence: index + 1, createdByUserId: userAId })) });
    const overflow = await stage("limite.jpg");
    await expect(createDamageEvidence(actorA, context.workOrderId, context.damageId, {}, overflow, storage)).rejects.toMatchObject({ code: "DAMAGE_EVIDENCE_LIMIT_REACHED" });
    expect(await storage.exists(overflow.storageKey)).toBe(false);
    expect(
      await prisma.fileAsset.findUnique({
        where: { storageKey: overflow.storageKey },
      }),
    ).toMatchObject({ status: "FAILED" });
  });

  it("bloqueia asset indisponível e reporta arquivo físico ausente", async () => {
    const context = await createContext(companyAId, branchAId, userAId);
    const evidence = await createDamageEvidence(actorA, context.workOrderId, context.damageId, {}, await stage("indisponivel.jpg"), storage);
    const attachment = await prisma.checkInDamageEvidenceAttachment.findUniqueOrThrow({ where: { id: evidence.id } });
    await prisma.fileAsset.update({ where: { id: attachment.fileAssetId }, data: { status: "FAILED", availableAt: null } });
    await expect(getDamageEvidenceContent(companyAId, context.workOrderId, context.damageId, evidence.id)).rejects.toMatchObject({ code: "DAMAGE_EVIDENCE_UNAVAILABLE" });

    const missing = await stage("ausente.jpg");
    const second = await createDamageEvidence(actorA, context.workOrderId, context.damageId, {}, missing, storage);
    await storage.remove(missing.storageKey);
    await expect(openDamageEvidenceContent(companyAId, context.workOrderId, context.damageId, second.id, storage)).rejects.toMatchObject({ code: "DAMAGE_EVIDENCE_FILE_MISSING" });
  });

  it("mantém consistência em upload simultâneo com conclusão", async () => {
    const context = await createContext(companyAId, branchAId, userAId);
    const staged = await stage("corrida.jpg");
    const [upload] = await Promise.allSettled([
      createDamageEvidence(actorA, context.workOrderId, context.damageId, {}, staged, storage),
      prisma.vehicleCheckIn.update({ where: { id: context.checkInId }, data: { status: "COMPLETED", completedAt: new Date() } }),
    ]);
    const active = await prisma.checkInDamageEvidenceAttachment.count({ where: { checkInId: context.checkInId, damageId: context.damageId, deletedAt: null } });
    const asset = await prisma.fileAsset.findUniqueOrThrow({ where: { storageKey: staged.storageKey } });
    if (upload.status === "fulfilled") {
      expect(active).toBe(1);
      expect(asset.status).toBe("AVAILABLE");
    } else {
      expect(active).toBe(0);
      expect(asset.status).toBe("FAILED");
      expect(await storage.exists(staged.storageKey)).toBe(false);
    }
  });

  async function stage(filename: string) {
    return storage.stage({ content: Readable.from([jpeg]), declaredMimeType: "image/jpeg", originalFilename: filename });
  }

  async function createContext(companyId: string, branchId: string, userId: string) {
    const customerId = randomUUID(), vehicleId = randomUUID(), workOrderId = randomUUID(), checkInId = randomUUID();
    await prisma.customer.create({ data: { id: customerId, companyId, name: "Cliente avaria" } });
    await prisma.vehicle.create({ data: { id: vehicleId, companyId, customerId, brand: "MovenCar", model: "Damage" } });
    await prisma.workOrder.create({ data: { id: workOrderId, companyId, branchId, customerId, vehicleId, attendantUserId: userId, number: orderNumber++, purpose: "INSPECTION" } });
    await prisma.vehicleCheckIn.create({ data: { id: checkInId, companyId, branchId, workOrderId, customerId, vehicleId, createdByUserId: userId } });
    const damage = await createDamage({ workOrderId, checkInId, vehicleId }, companyId, userId);
    return { workOrderId, checkInId, vehicleId, damageId: damage.id };
  }
});

async function createDamage(context: { workOrderId: string; checkInId: string; vehicleId: string }, companyId: string, userId: string) {
  return prisma.checkInDamage.create({ data: { companyId, workOrderId: context.workOrderId, checkInId: context.checkInId, vehicleId: context.vehicleId, location: "FRONT_BUMPER", damageType: "SCRATCH", severity: "MINOR", observedByUserId: userId } });
}

async function createTenant(suffix: string, companyId: string, branchId: string, userId: string) {
  await prisma.company.create({ data: { id: companyId, code: `damage-${suffix}-${companyId}`, legalName: `Empresa ${suffix}`, tradeName: `Empresa ${suffix}` } });
  await prisma.branch.create({ data: { id: branchId, companyId, code: suffix, name: `Filial ${suffix}` } });
  await prisma.user.create({ data: { id: userId, companyId, defaultBranchId: branchId, name: `Usuário ${suffix}`, email: `${userId}@example.invalid`, passwordHash: "x" } });
}

function assetData(id: string, companyId: string, uploadedByUserId: string) {
  return { id, companyId, storageKey: `objects/${randomUUID()}.jpg`, originalFilename: "avaria.jpg", declaredMimeType: "image/jpeg", detectedMimeType: "image/jpeg", canonicalExtension: "jpg", sizeBytes: BigInt(jpeg.length), sha256: "a".repeat(64), ownershipType: "CHECK_IN_DAMAGE" as const, uploadedByUserId, status: "AVAILABLE" as const, availableAt: new Date() };
}

async function consume(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
