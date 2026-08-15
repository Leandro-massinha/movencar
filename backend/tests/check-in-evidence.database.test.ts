import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalPrivateStorageProvider } from "../src/lib/private-storage/index.js";
import { prisma } from "../src/lib/prisma.js";
import {
  createCheckInEvidence,
  deleteCheckInEvidence,
  getCheckInEvidenceContent,
  listCheckInEvidence,
  MAX_GENERAL_CHECK_IN_EVIDENCE,
  openCheckInEvidenceContent,
} from "../src/modules/work-orders/check-in-evidence.service.js";
import type { WorkOrderActor } from "../src/modules/work-orders/work-orders.service.js";

const suite =
  process.env.CHECK_IN_EVIDENCE_DATABASE_TESTS === "1"
    ? describe
    : describe.skip;

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

suite("evidências gerais do Check-in no PostgreSQL", () => {
  const companyAId = randomUUID();
  const companyBId = randomUUID();
  const branchAId = randomUUID();
  const branchBId = randomUUID();
  const userAId = randomUUID();
  const userBId = randomUUID();
  const actorA: WorkOrderActor = {
    companyId: companyAId,
    branchId: branchAId,
    userId: userAId,
    ipAddress: "127.0.0.1",
    userAgent: "evidence-test",
  };
  let temporaryRoot: string;
  let storage: LocalPrivateStorageProvider;
  let orderNumber = 1000;

  beforeAll(async () => {
    temporaryRoot = await mkdtemp(
      path.join(tmpdir(), "movencar-checkin-evidence-db-"),
    );
    storage = new LocalPrivateStorageProvider({
      root: temporaryRoot,
      maxBytes: 1024,
    });
    await createTenant("A", companyAId, branchAId, userAId);
    await createTenant("B", companyBId, branchBId, userBId);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  it("cria asset AVAILABLE, ownership, vínculo, DTO público e AuditLog", async () => {
    const context = await createCheckIn(companyAId, branchAId, userAId);
    const staged = await stageJpeg("dianteira.jpg");
    const evidence = await createCheckInEvidence(
      actorA,
      context.workOrderId,
      { category: "FRONT", caption: "Vista dianteira" },
      staged,
      storage,
    );
    expect(evidence).toMatchObject({
      category: "FRONT",
      caption: "Vista dianteira",
      sequence: 1,
      originalFilename: "dianteira.jpg",
      detectedMimeType: "image/jpeg",
      sizeBytes: jpeg.length,
      uploader: { id: userAId },
    });
    expect(evidence).not.toHaveProperty("companyId");
    expect(evidence).not.toHaveProperty("storageKey");
    const attachment = await prisma.checkInEvidenceAttachment.findUniqueOrThrow({
      where: { id: evidence.id },
      include: { fileAsset: true },
    });
    expect(attachment.fileAsset).toMatchObject({
      status: "AVAILABLE",
      ownershipType: "CHECK_IN",
      declaredMimeType: "image/jpeg",
      detectedMimeType: "image/jpeg",
    });
    expect(attachment.fileAsset.availableAt).toBeInstanceOf(Date);
    expect(await storage.exists(staged.storageKey)).toBe(true);
    expect(
      await prisma.auditLog.findFirst({
        where: {
          companyId: companyAId,
          entityId: evidence.id,
          action: "CHECK_IN_EVIDENCE_UPLOAD",
        },
      }),
    ).toBeTruthy();
    expect(await listCheckInEvidence(companyAId, context.workOrderId)).toEqual([
      evidence,
    ]);
  });

  it("serializa uploads simultâneos e gera sequences estáveis", async () => {
    const context = await createCheckIn(companyAId, branchAId, userAId);
    const [first, second] = await Promise.all([
      stageJpeg("um.jpg"),
      stageJpeg("dois.jpg"),
    ]);
    const results = await Promise.all([
      createCheckInEvidence(
        actorA,
        context.workOrderId,
        { category: "REAR" },
        first,
        storage,
      ),
      createCheckInEvidence(
        actorA,
        context.workOrderId,
        { category: "REAR" },
        second,
        storage,
      ),
    ]);
    expect(results.map(({ sequence }) => sequence).sort()).toEqual([1, 2]);
  });

  it("permite leitura após conclusão, mas bloqueia upload e exclusão", async () => {
    const context = await createCheckIn(companyAId, branchAId, userAId);
    const evidence = await createCheckInEvidence(
      actorA,
      context.workOrderId,
      { category: "DASHBOARD" },
      await stageJpeg("painel.jpg"),
      storage,
    );
    await prisma.vehicleCheckIn.update({
      where: { id: context.checkInId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    expect(await listCheckInEvidence(companyAId, context.workOrderId)).toHaveLength(1);
    expect(
      await getCheckInEvidenceContent(
        companyAId,
        context.workOrderId,
        evidence.id,
      ),
    ).toMatchObject({ status: "AVAILABLE" });
    const opened = await openCheckInEvidenceContent(
      companyAId,
      context.workOrderId,
      evidence.id,
      storage,
    );
    expect(await consume(opened.stream)).toEqual(jpeg);
    await expect(
      createCheckInEvidence(
        actorA,
        context.workOrderId,
        { category: "REAR" },
        await stageJpeg("tardia.jpg"),
        storage,
      ),
    ).rejects.toMatchObject({ code: "CHECK_IN_NOT_EDITABLE" });
    await expect(
      deleteCheckInEvidence(actorA, context.workOrderId, evidence.id),
    ).rejects.toMatchObject({ code: "CHECK_IN_NOT_EDITABLE" });
  });

  it("faz soft delete sem remover arquivo físico ou liberar asset", async () => {
    const context = await createCheckIn(companyAId, branchAId, userAId);
    const staged = await stageJpeg("exclusao.jpg");
    const evidence = await createCheckInEvidence(
      actorA,
      context.workOrderId,
      { category: "OTHER" },
      staged,
      storage,
    );
    await deleteCheckInEvidence(actorA, context.workOrderId, evidence.id);
    expect(await listCheckInEvidence(companyAId, context.workOrderId)).toEqual([]);
    await expect(
      getCheckInEvidenceContent(companyAId, context.workOrderId, evidence.id),
    ).rejects.toMatchObject({ code: "CHECK_IN_EVIDENCE_NOT_FOUND" });
    const attachment = await prisma.checkInEvidenceAttachment.findUniqueOrThrow({
      where: { id: evidence.id },
      include: { fileAsset: true },
    });
    expect(attachment.deletedAt).toBeInstanceOf(Date);
    expect(attachment.fileAsset).toMatchObject({ status: "DELETED" });
    expect(await storage.exists(staged.storageKey)).toBe(true);
    expect(
      await prisma.auditLog.count({
        where: { entityId: evidence.id, action: "CHECK_IN_EVIDENCE_DELETE" },
      }),
    ).toBe(1);
  });

  it("isola tenant na listagem, conteúdo e exclusão", async () => {
    const contextA = await createCheckIn(companyAId, branchAId, userAId);
    const contextB = await createCheckIn(companyBId, branchBId, userBId);
    const evidence = await createCheckInEvidence(
      actorA,
      contextA.workOrderId,
      { category: "ODOMETER" },
      await stageJpeg("odometro.jpg"),
      storage,
    );
    expect(await listCheckInEvidence(companyBId, contextB.workOrderId)).toEqual([]);
    await expect(
      getCheckInEvidenceContent(companyBId, contextB.workOrderId, evidence.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      deleteCheckInEvidence(
        { companyId: companyBId, branchId: branchBId, userId: userBId },
        contextB.workOrderId,
        evidence.id,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("rejeita assets PENDING, FAILED e DELETED no conteúdo", async () => {
    const context = await createCheckIn(companyAId, branchAId, userAId);
    for (const [index, status] of ["PENDING", "FAILED", "DELETED"].entries()) {
      const assetId = randomUUID();
      const deletedAt = status === "DELETED" ? new Date() : null;
      await prisma.fileAsset.create({
        data: assetData(assetId, companyAId, userAId, "CHECK_IN", {
          status: status as "PENDING" | "FAILED" | "DELETED",
          deletedAt,
        }),
      });
      const attachment = await prisma.checkInEvidenceAttachment.create({
        data: {
          companyId: companyAId,
          checkInId: context.checkInId,
          fileAssetId: assetId,
          category: "OTHER",
          sequence: index + 1,
          createdByUserId: userAId,
        },
      });
      await expect(
        getCheckInEvidenceContent(
          companyAId,
          context.workOrderId,
          attachment.id,
        ),
      ).rejects.toMatchObject({ code: "CHECK_IN_EVIDENCE_UNAVAILABLE" });
    }
  });

  it("retorna erro controlado quando o arquivo físico está ausente", async () => {
    const context = await createCheckIn(companyAId, branchAId, userAId);
    const staged = await stageJpeg("ausente.jpg");
    const evidence = await createCheckInEvidence(
      actorA,
      context.workOrderId,
      { category: "ENGINE_BAY" },
      staged,
      storage,
    );
    await storage.remove(staged.storageKey);
    await expect(
      openCheckInEvidenceContent(
        companyAId,
        context.workOrderId,
        evidence.id,
        storage,
      ),
    ).rejects.toMatchObject({ code: "CHECK_IN_EVIDENCE_FILE_MISSING" });
  });

  it("compensa falha de promoção e falha transacional após promoção", async () => {
    const promotionContext = await createCheckIn(companyAId, branchAId, userAId);
    const promotionStage = await stageJpeg("promocao.jpg");
    const failingStorage = {
      ...storage,
      stage: storage.stage.bind(storage),
      open: storage.open.bind(storage),
      stat: storage.stat.bind(storage),
      remove: storage.remove.bind(storage),
      exists: storage.exists.bind(storage),
      promote: async () => {
        throw new Error("falha simulada");
      },
    };
    await expect(
      createCheckInEvidence(
        actorA,
        promotionContext.workOrderId,
        { category: "FRONT" },
        promotionStage,
        failingStorage,
      ),
    ).rejects.toMatchObject({ code: "PRIVATE_STORAGE_PROMOTION_FAILED" });
    expect(await storage.exists(promotionStage.stagingKey)).toBe(false);
    expect(
      await prisma.fileAsset.findUnique({
        where: { storageKey: promotionStage.storageKey },
      }),
    ).toMatchObject({ status: "FAILED" });

    const transactionContext = await createCheckIn(companyAId, branchAId, userAId);
    const transactionStage = await stageJpeg("transacao.jpg");
    await prisma.vehicleCheckIn.update({
      where: { id: transactionContext.checkInId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await expect(
      createCheckInEvidence(
        actorA,
        transactionContext.workOrderId,
        { category: "FRONT" },
        transactionStage,
        storage,
      ),
    ).rejects.toMatchObject({ code: "CHECK_IN_NOT_EDITABLE" });
    expect(await storage.exists(transactionStage.storageKey)).toBe(false);
    expect(
      await prisma.fileAsset.findUnique({
        where: { storageKey: transactionStage.storageKey },
      }),
    ).toMatchObject({ status: "FAILED" });
    expect(
      await prisma.checkInEvidenceAttachment.count({
        where: { fileAsset: { storageKey: transactionStage.storageKey } },
      }),
    ).toBe(0);
  });

  it("compensa falha de banco antes da promoção", async () => {
    const context = await createCheckIn(companyAId, branchAId, userAId);
    const staged = await stageJpeg("banco.jpg");
    await prisma.fileAsset.create({
      data: {
        ...assetData(randomUUID(), companyAId, userAId, "CHECK_IN"),
        storageKey: staged.storageKey,
      },
    });
    await expect(
      createCheckInEvidence(
        actorA,
        context.workOrderId,
        { category: "FRONT" },
        staged,
        storage,
      ),
    ).rejects.toMatchObject({ code: "CHECK_IN_EVIDENCE_CONFLICT" });
    expect(await storage.exists(staged.stagingKey)).toBe(false);
    expect(
      await prisma.checkInEvidenceAttachment.count({
        where: { checkInId: context.checkInId },
      }),
    ).toBe(0);
  });

  it("mantém consistência em upload simultâneo com conclusão", async () => {
    const context = await createCheckIn(companyAId, branchAId, userAId);
    const staged = await stageJpeg("corrida.jpg");
    const [uploadResult, completionResult] = await Promise.allSettled([
      createCheckInEvidence(
        actorA,
        context.workOrderId,
        { category: "FRONT" },
        staged,
        storage,
      ),
      prisma.vehicleCheckIn.update({
        where: { id: context.checkInId },
        data: { status: "COMPLETED", completedAt: new Date() },
      }),
    ]);
    expect(completionResult.status).toBe("fulfilled");
    const active = await prisma.checkInEvidenceAttachment.count({
      where: { checkInId: context.checkInId, deletedAt: null },
    });
    const asset = await prisma.fileAsset.findUniqueOrThrow({
      where: { storageKey: staged.storageKey },
    });
    if (uploadResult.status === "fulfilled") {
      expect(active).toBe(1);
      expect(asset.status).toBe("AVAILABLE");
      expect(await storage.exists(staged.storageKey)).toBe(true);
    } else {
      expect(active).toBe(0);
      expect(asset.status).toBe("FAILED");
      expect(await storage.exists(staged.storageKey)).toBe(false);
    }
  });

  it("aplica limite de 50 evidências gerais e compensa a excedente", async () => {
    const context = await createCheckIn(companyAId, branchAId, userAId);
    const assets = Array.from({ length: MAX_GENERAL_CHECK_IN_EVIDENCE }, (_, index) => ({
      id: randomUUID(),
      index,
    }));
    await prisma.fileAsset.createMany({
      data: assets.map(({ id }) =>
        assetData(id, companyAId, userAId, "CHECK_IN", {
          status: "AVAILABLE",
          availableAt: new Date(),
        }),
      ),
    });
    await prisma.checkInEvidenceAttachment.createMany({
      data: assets.map(({ id, index }) => ({
        companyId: companyAId,
        checkInId: context.checkInId,
        fileAssetId: id,
        category: "OTHER" as const,
        sequence: index + 1,
        createdByUserId: userAId,
      })),
    });
    const overflow = await stageJpeg("limite.jpg");
    await expect(
      createCheckInEvidence(
        actorA,
        context.workOrderId,
        { category: "OTHER" },
        overflow,
        storage,
      ),
    ).rejects.toMatchObject({ code: "CHECK_IN_EVIDENCE_LIMIT_REACHED" });
    expect(await storage.exists(overflow.storageKey)).toBe(false);
    expect(
      await prisma.fileAsset.findUnique({ where: { storageKey: overflow.storageKey } }),
    ).toMatchObject({ status: "FAILED" });
  });

  async function stageJpeg(filename: string) {
    return storage.stage({
      content: Readable.from([jpeg]),
      declaredMimeType: "image/jpeg",
      originalFilename: filename,
    });
  }

  async function createCheckIn(
    companyId: string,
    branchId: string,
    userId: string,
  ) {
    const customerId = randomUUID();
    const vehicleId = randomUUID();
    const workOrderId = randomUUID();
    const checkInId = randomUUID();
    await prisma.customer.create({
      data: { id: customerId, companyId, name: "Cliente evidência" },
    });
    await prisma.vehicle.create({
      data: {
        id: vehicleId,
        companyId,
        customerId,
        brand: "MovenCar",
        model: "Evidence",
      },
    });
    await prisma.workOrder.create({
      data: {
        id: workOrderId,
        companyId,
        branchId,
        customerId,
        vehicleId,
        attendantUserId: userId,
        number: orderNumber++,
        purpose: "INSPECTION",
      },
    });
    await prisma.vehicleCheckIn.create({
      data: {
        id: checkInId,
        companyId,
        branchId,
        workOrderId,
        customerId,
        vehicleId,
        createdByUserId: userId,
      },
    });
    return { workOrderId, checkInId };
  }
});

async function createTenant(
  suffix: string,
  companyId: string,
  branchId: string,
  userId: string,
) {
  await prisma.company.create({
    data: {
      id: companyId,
      code: `evidence-${suffix}-${companyId}`,
      legalName: `Empresa ${suffix}`,
      tradeName: `Empresa ${suffix}`,
    },
  });
  await prisma.branch.create({
    data: { id: branchId, companyId, code: suffix, name: `Filial ${suffix}` },
  });
  await prisma.user.create({
    data: {
      id: userId,
      companyId,
      defaultBranchId: branchId,
      name: `Usuário ${suffix}`,
      email: `${userId}@example.invalid`,
      passwordHash: "x",
    },
  });
}

function assetData(
  id: string,
  companyId: string,
  uploadedByUserId: string,
  ownershipType: "CHECK_IN",
  override: Partial<{
    status: "PENDING" | "AVAILABLE" | "FAILED" | "DELETED";
    availableAt: Date | null;
    deletedAt: Date | null;
  }> = {},
) {
  return {
    id,
    companyId,
    storageKey: `objects/${randomUUID()}.jpg`,
    originalFilename: "evidencia.jpg",
    declaredMimeType: "image/jpeg",
    detectedMimeType: "image/jpeg",
    canonicalExtension: "jpg",
    sizeBytes: 100n,
    sha256: "a".repeat(64),
    ownershipType,
    uploadedByUserId,
    status: override.status ?? ("PENDING" as const),
    availableAt: override.availableAt,
    deletedAt: override.deletedAt,
  };
}

async function consume(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
