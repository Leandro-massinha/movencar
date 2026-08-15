import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { Prisma as PrismaRuntime } from "@prisma/client";
import { env, privateStorageRoot } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import {
  LocalPrivateStorageProvider,
  type PrivateStorageProvider,
  type StagedPrivateImage,
} from "../../lib/private-storage/index.js";
import { prisma } from "../../lib/prisma.js";
import type { CheckInEvidenceFields } from "./check-in-evidence.schemas.js";
import type { WorkOrderActor } from "./work-orders.service.js";

export const MAX_GENERAL_CHECK_IN_EVIDENCE = 50;

export const checkInEvidenceStorage: PrivateStorageProvider =
  new LocalPrivateStorageProvider({
    root: privateStorageRoot,
    maxBytes: env.PHOTO_MAX_BYTES,
  });

const evidenceSelect = {
  id: true,
  category: true,
  caption: true,
  sequence: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
  fileAsset: {
    select: {
      originalFilename: true,
      detectedMimeType: true,
      sizeBytes: true,
    },
  },
} satisfies Prisma.CheckInEvidenceAttachmentSelect;

export async function assertCheckInEvidenceUploadAllowed(
  actor: WorkOrderActor,
  workOrderId: string,
) {
  const context = await prisma.workOrder.findFirst({
    where: { id: workOrderId, companyId: actor.companyId },
    select: {
      id: true,
      checkIn: { select: { id: true, status: true } },
    },
  });
  if (!context)
    throw new AppError(
      404,
      "WORK_ORDER_NOT_FOUND",
      "Ordem de Serviço não encontrada.",
    );
  if (!context.checkIn)
    throw new AppError(404, "CHECK_IN_NOT_FOUND", "Check-in não encontrado.");
  if (context.checkIn.status !== "DRAFT")
    throw new AppError(
      409,
      "CHECK_IN_NOT_EDITABLE",
      "Somente um Check-in em rascunho pode receber evidências.",
    );
}

export async function createCheckInEvidence(
  actor: WorkOrderActor,
  workOrderId: string,
  fields: CheckInEvidenceFields,
  staged: StagedPrivateImage,
  storage: PrivateStorageProvider = checkInEvidenceStorage,
) {
  const fileAssetId = randomUUID();
  let promoted = false;
  let pendingCreated = false;
  try {
    await prisma.fileAsset.create({
      data: {
        id: fileAssetId,
        companyId: actor.companyId,
        storageProvider: "LOCAL_PRIVATE",
        storageKey: staged.storageKey,
        originalFilename: staged.originalFilename,
        declaredMimeType: staged.declaredMimeType,
        detectedMimeType: staged.detectedMimeType,
        canonicalExtension: staged.canonicalExtension,
        sizeBytes: BigInt(staged.size),
        sha256: staged.sha256,
        status: "PENDING",
        ownershipType: "CHECK_IN",
        uploadedByUserId: actor.userId,
      },
    });
    pendingCreated = true;
    try {
      await storage.promote(staged.stagingKey, staged.storageKey);
    } catch {
      throw new AppError(
        503,
        "PRIVATE_STORAGE_PROMOTION_FAILED",
        "Não foi possível armazenar a evidência com segurança.",
      );
    }
    promoted = true;

    const result = await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ id: string; branchId: string; status: string }>
        >(PrismaRuntime.sql`
          SELECT ci."id", ci."branchId", ci."status"
          FROM "VehicleCheckIn" ci
          INNER JOIN "WorkOrder" wo
            ON wo."id" = ci."workOrderId" AND wo."companyId" = ci."companyId"
          WHERE wo."id" = ${workOrderId}::uuid
            AND wo."companyId" = ${actor.companyId}::uuid
            AND ci."companyId" = ${actor.companyId}::uuid
          FOR UPDATE OF ci
        `);
        const checkIn = rows[0];
        if (!checkIn)
          throw new AppError(
            404,
            "CHECK_IN_NOT_FOUND",
            "Check-in não encontrado.",
          );
        if (checkIn.status !== "DRAFT")
          throw new AppError(
            409,
            "CHECK_IN_NOT_EDITABLE",
            "Somente um Check-in em rascunho pode receber evidências.",
          );

        const aggregate = await tx.checkInEvidenceAttachment.aggregate({
          where: {
            companyId: actor.companyId,
            checkInId: checkIn.id,
            deletedAt: null,
          },
          _count: { _all: true },
        });
        if (aggregate._count._all >= MAX_GENERAL_CHECK_IN_EVIDENCE)
          throw new AppError(
            409,
            "CHECK_IN_EVIDENCE_LIMIT_REACHED",
            `O Check-in atingiu o limite de ${MAX_GENERAL_CHECK_IN_EVIDENCE} fotos gerais.`,
          );
        const sequence = await tx.checkInEvidenceAttachment.aggregate({
          where: {
            companyId: actor.companyId,
            checkInId: checkIn.id,
            category: fields.category,
          },
          _max: { sequence: true },
        });
        const evidence = await tx.checkInEvidenceAttachment.create({
          data: {
            companyId: actor.companyId,
            checkInId: checkIn.id,
            fileAssetId,
            category: fields.category,
            caption: fields.caption,
            sequence: (sequence._max.sequence ?? 0) + 1,
            createdByUserId: actor.userId,
          },
          select: evidenceSelect,
        });
        const availableAt = new Date();
        const assetChanged = await tx.fileAsset.updateMany({
          where: {
            id: fileAssetId,
            companyId: actor.companyId,
            status: "PENDING",
            ownershipType: "CHECK_IN",
          },
          data: { status: "AVAILABLE", availableAt },
        });
        if (!assetChanged.count)
          throw new AppError(
            409,
            "FILE_ASSET_NOT_PENDING",
            "A evidência não está disponível para conclusão.",
          );
        await tx.auditLog.create({
          data: {
            companyId: actor.companyId,
            branchId: checkIn.branchId,
            actorUserId: actor.userId,
            action: "CHECK_IN_EVIDENCE_UPLOAD",
            entityType: "CheckInEvidenceAttachment",
            entityId: evidence.id,
            metadata: {
              evidenceId: evidence.id,
              category: evidence.category,
              sizeBytes: staged.size,
              detectedMimeType: staged.detectedMimeType,
              workOrderId,
              checkInId: checkIn.id,
            },
            ipAddress: actor.ipAddress,
            userAgent: actor.userAgent,
          },
        });
        return evidence;
      },
      { maxWait: 30_000, timeout: 15_000 },
    );
    return publicEvidence(result);
  } catch (error) {
    await storage
      .remove(promoted ? staged.storageKey : staged.stagingKey)
      .catch(() => undefined);
    if (pendingCreated) {
      await prisma.fileAsset
        .updateMany({
          where: {
            id: fileAssetId,
            companyId: actor.companyId,
            status: "PENDING",
          },
          data: { status: "FAILED" },
        })
        .catch(() => undefined);
    }
    if (
      error instanceof PrismaRuntime.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new AppError(
        409,
        "CHECK_IN_EVIDENCE_CONFLICT",
        "Outra evidência foi registrada ao mesmo tempo. Tente novamente.",
      );
    throw error;
  }
}

export async function listCheckInEvidence(
  companyId: string,
  workOrderId: string,
) {
  await assertReadableCheckIn(companyId, workOrderId);
  const rows = await prisma.checkInEvidenceAttachment.findMany({
    where: {
      companyId,
      deletedAt: null,
      checkIn: { workOrderId, companyId },
      fileAsset: { status: "AVAILABLE", deletedAt: null },
    },
    select: evidenceSelect,
    orderBy: [
      { category: "asc" },
      { sequence: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });
  return rows.map(publicEvidence);
}

export async function getCheckInEvidenceContent(
  companyId: string,
  workOrderId: string,
  evidenceId: string,
) {
  await assertReadableCheckIn(companyId, workOrderId);
  const evidence = await prisma.checkInEvidenceAttachment.findFirst({
    where: {
      id: evidenceId,
      companyId,
      deletedAt: null,
      checkIn: { workOrderId, companyId },
    },
    select: {
      fileAsset: {
        select: {
          storageKey: true,
          originalFilename: true,
          detectedMimeType: true,
          sizeBytes: true,
          status: true,
          deletedAt: true,
        },
      },
    },
  });
  if (!evidence)
    throw new AppError(
      404,
      "CHECK_IN_EVIDENCE_NOT_FOUND",
      "Evidência não encontrada.",
    );
  if (
    evidence.fileAsset.status !== "AVAILABLE" ||
    evidence.fileAsset.deletedAt
  )
    throw new AppError(
      409,
      "CHECK_IN_EVIDENCE_UNAVAILABLE",
      "O arquivo da evidência não está disponível.",
    );
  return evidence.fileAsset;
}

export async function openCheckInEvidenceContent(
  companyId: string,
  workOrderId: string,
  evidenceId: string,
  storage: PrivateStorageProvider = checkInEvidenceStorage,
) {
  const asset = await getCheckInEvidenceContent(
    companyId,
    workOrderId,
    evidenceId,
  );
  try {
    if (!(await storage.exists(asset.storageKey)))
      throw new AppError(
        409,
        "CHECK_IN_EVIDENCE_FILE_MISSING",
        "O arquivo físico da evidência não foi encontrado.",
      );
    const info = await storage.stat(asset.storageKey);
    if (BigInt(info.size) !== asset.sizeBytes)
      throw new AppError(
        409,
        "CHECK_IN_EVIDENCE_FILE_INVALID",
        "O arquivo físico da evidência está inconsistente.",
      );
    return { asset, stream: await storage.open(asset.storageKey) };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      503,
      "PRIVATE_STORAGE_UNAVAILABLE",
      "O armazenamento privado está temporariamente indisponível.",
    );
  }
}

export async function deleteCheckInEvidence(
  actor: WorkOrderActor,
  workOrderId: string,
  evidenceId: string,
) {
  const now = new Date();
  await prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; branchId: string; status: string }>
      >(PrismaRuntime.sql`
        SELECT ci."id", ci."branchId", ci."status"
        FROM "VehicleCheckIn" ci
        INNER JOIN "WorkOrder" wo
          ON wo."id" = ci."workOrderId" AND wo."companyId" = ci."companyId"
        WHERE wo."id" = ${workOrderId}::uuid
          AND wo."companyId" = ${actor.companyId}::uuid
          AND ci."companyId" = ${actor.companyId}::uuid
        FOR UPDATE OF ci
      `);
      const checkIn = rows[0];
      if (!checkIn)
        throw new AppError(
          404,
          "CHECK_IN_NOT_FOUND",
          "Check-in não encontrado.",
        );
      if (checkIn.status !== "DRAFT")
        throw new AppError(
          409,
          "CHECK_IN_NOT_EDITABLE",
          "Somente um Check-in em rascunho pode excluir evidências.",
        );
      const evidence = await tx.checkInEvidenceAttachment.findFirst({
        where: {
          id: evidenceId,
          companyId: actor.companyId,
          checkInId: checkIn.id,
          deletedAt: null,
        },
        select: { id: true, category: true, fileAssetId: true },
      });
      if (!evidence)
        throw new AppError(
          404,
          "CHECK_IN_EVIDENCE_NOT_FOUND",
          "Evidência não encontrada.",
        );
      const removed = await tx.checkInEvidenceAttachment.updateMany({
        where: {
          id: evidence.id,
          companyId: actor.companyId,
          deletedAt: null,
        },
        data: { deletedAt: now },
      });
      const assetRemoved = await tx.fileAsset.updateMany({
        where: {
          id: evidence.fileAssetId,
          companyId: actor.companyId,
          status: "AVAILABLE",
          deletedAt: null,
        },
        data: { status: "DELETED", deletedAt: now },
      });
      if (!removed.count || !assetRemoved.count)
        throw new AppError(
          409,
          "CHECK_IN_EVIDENCE_DELETE_CONFLICT",
          "A evidência foi alterada por outra operação.",
        );
      await tx.auditLog.create({
        data: {
          companyId: actor.companyId,
          branchId: checkIn.branchId,
          actorUserId: actor.userId,
          action: "CHECK_IN_EVIDENCE_DELETE",
          entityType: "CheckInEvidenceAttachment",
          entityId: evidence.id,
          metadata: {
            evidenceId: evidence.id,
            category: evidence.category,
            workOrderId,
            checkInId: checkIn.id,
          },
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });
    },
    { maxWait: 30_000, timeout: 15_000 },
  );
}

async function assertReadableCheckIn(companyId: string, workOrderId: string) {
  const context = await prisma.workOrder.findFirst({
    where: { id: workOrderId, companyId },
    select: { checkIn: { select: { id: true } } },
  });
  if (!context)
    throw new AppError(
      404,
      "WORK_ORDER_NOT_FOUND",
      "Ordem de Serviço não encontrada.",
    );
  if (!context.checkIn)
    throw new AppError(404, "CHECK_IN_NOT_FOUND", "Check-in não encontrado.");
}

function publicEvidence(row: {
  id: string;
  category: string;
  caption: string | null;
  sequence: number;
  createdAt: Date;
  createdBy: { id: string; name: string };
  fileAsset: {
    originalFilename: string;
    detectedMimeType: string;
    sizeBytes: bigint;
  };
}) {
  return {
    id: row.id,
    category: row.category,
    caption: row.caption,
    sequence: row.sequence,
    originalFilename: row.fileAsset.originalFilename,
    detectedMimeType: row.fileAsset.detectedMimeType,
    sizeBytes: Number(row.fileAsset.sizeBytes),
    createdAt: row.createdAt,
    uploader: row.createdBy,
  };
}
