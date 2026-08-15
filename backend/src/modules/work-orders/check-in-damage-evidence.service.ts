import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { Prisma as PrismaRuntime } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import type {
  PrivateStorageProvider,
  StagedPrivateImage,
} from "../../lib/private-storage/index.js";
import { prisma } from "../../lib/prisma.js";
import type { DamageEvidenceFields } from "./check-in-damage-evidence.schemas.js";
import { checkInEvidenceStorage } from "./check-in-evidence.service.js";
import type { WorkOrderActor } from "./work-orders.service.js";

export const MAX_DAMAGE_EVIDENCE = 20;

const damageEvidenceSelect = {
  id: true,
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
} satisfies Prisma.CheckInDamageEvidenceAttachmentSelect;

export async function assertDamageEvidenceUploadAllowed(
  actor: WorkOrderActor,
  workOrderId: string,
  damageId: string,
) {
  const context = await findDamageContext(actor.companyId, workOrderId, damageId);
  if (context.checkIn.status !== "DRAFT")
    throw new AppError(
      409,
      "CHECK_IN_NOT_EDITABLE",
      "Somente um Check-in em rascunho pode receber evidências de avaria.",
    );
}

export async function createDamageEvidence(
  actor: WorkOrderActor,
  workOrderId: string,
  damageId: string,
  fields: DamageEvidenceFields,
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
        ownershipType: "CHECK_IN_DAMAGE",
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
        const checkIn = await lockCheckIn(
          tx,
          actor.companyId,
          workOrderId,
        );
        if (checkIn.status !== "DRAFT")
          throw new AppError(
            409,
            "CHECK_IN_NOT_EDITABLE",
            "Somente um Check-in em rascunho pode receber evidências de avaria.",
          );
        const damage = await tx.checkInDamage.findFirst({
          where: {
            id: damageId,
            companyId: actor.companyId,
            checkInId: checkIn.id,
            workOrderId,
          },
          select: { id: true, location: true, damageType: true },
        });
        if (!damage)
          throw new AppError(
            404,
            "CHECK_IN_DAMAGE_NOT_FOUND",
            "Avaria não encontrada.",
          );
        const [activeCount, sequenceAggregate] = await Promise.all([
          tx.checkInDamageEvidenceAttachment.count({
            where: {
              companyId: actor.companyId,
              checkInId: checkIn.id,
              damageId,
              deletedAt: null,
            },
          }),
          tx.checkInDamageEvidenceAttachment.aggregate({
            where: {
              companyId: actor.companyId,
              checkInId: checkIn.id,
              damageId,
            },
            _max: { sequence: true },
          }),
        ]);
        if (activeCount >= MAX_DAMAGE_EVIDENCE)
          throw new AppError(
            409,
            "DAMAGE_EVIDENCE_LIMIT_REACHED",
            `A avaria atingiu o limite de ${MAX_DAMAGE_EVIDENCE} fotos.`,
          );
        const evidence = await tx.checkInDamageEvidenceAttachment.create({
          data: {
            companyId: actor.companyId,
            checkInId: checkIn.id,
            damageId,
            fileAssetId,
            caption: fields.caption,
            sequence: (sequenceAggregate._max.sequence ?? 0) + 1,
            createdByUserId: actor.userId,
          },
          select: damageEvidenceSelect,
        });
        const changed = await tx.fileAsset.updateMany({
          where: {
            id: fileAssetId,
            companyId: actor.companyId,
            status: "PENDING",
            ownershipType: "CHECK_IN_DAMAGE",
          },
          data: { status: "AVAILABLE", availableAt: new Date() },
        });
        if (!changed.count)
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
            action: "DAMAGE_EVIDENCE_UPLOAD",
            entityType: "CheckInDamageEvidenceAttachment",
            entityId: evidence.id,
            metadata: {
              evidenceId: evidence.id,
              damageId,
              damageType: damage.damageType,
              location: damage.location,
              workOrderId,
              checkInId: checkIn.id,
              sizeBytes: staged.size,
              detectedMimeType: staged.detectedMimeType,
            },
            ipAddress: actor.ipAddress,
            userAgent: actor.userAgent,
          },
        });
        return evidence;
      },
      { maxWait: 30_000, timeout: 15_000 },
    );
    return publicDamageEvidence(result);
  } catch (error) {
    await storage
      .remove(promoted ? staged.storageKey : staged.stagingKey)
      .catch(() => undefined);
    if (pendingCreated)
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
    if (
      error instanceof PrismaRuntime.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new AppError(
        409,
        "DAMAGE_EVIDENCE_CONFLICT",
        "Outra evidência foi registrada ao mesmo tempo. Tente novamente.",
      );
    throw error;
  }
}

export async function listDamageEvidence(
  companyId: string,
  workOrderId: string,
  damageId: string,
) {
  const context = await findDamageContext(companyId, workOrderId, damageId);
  const rows = await prisma.checkInDamageEvidenceAttachment.findMany({
    where: {
      companyId,
      checkInId: context.checkIn.id,
      damageId,
      deletedAt: null,
      fileAsset: { status: "AVAILABLE", deletedAt: null },
    },
    select: damageEvidenceSelect,
    orderBy: [{ sequence: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(publicDamageEvidence);
}

export async function getDamageEvidenceContent(
  companyId: string,
  workOrderId: string,
  damageId: string,
  evidenceId: string,
) {
  const context = await findDamageContext(companyId, workOrderId, damageId);
  const evidence = await prisma.checkInDamageEvidenceAttachment.findFirst({
    where: {
      id: evidenceId,
      companyId,
      checkInId: context.checkIn.id,
      damageId,
      deletedAt: null,
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
      "DAMAGE_EVIDENCE_NOT_FOUND",
      "Evidência de avaria não encontrada.",
    );
  if (
    evidence.fileAsset.status !== "AVAILABLE" ||
    evidence.fileAsset.deletedAt
  )
    throw new AppError(
      409,
      "DAMAGE_EVIDENCE_UNAVAILABLE",
      "O arquivo da evidência não está disponível.",
    );
  return evidence.fileAsset;
}

export async function openDamageEvidenceContent(
  companyId: string,
  workOrderId: string,
  damageId: string,
  evidenceId: string,
  storage: PrivateStorageProvider = checkInEvidenceStorage,
) {
  const asset = await getDamageEvidenceContent(
    companyId,
    workOrderId,
    damageId,
    evidenceId,
  );
  try {
    if (!(await storage.exists(asset.storageKey)))
      throw new AppError(
        409,
        "DAMAGE_EVIDENCE_FILE_MISSING",
        "O arquivo físico da evidência não foi encontrado.",
      );
    const info = await storage.stat(asset.storageKey);
    if (BigInt(info.size) !== asset.sizeBytes)
      throw new AppError(
        409,
        "DAMAGE_EVIDENCE_FILE_INVALID",
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

export async function deleteDamageEvidence(
  actor: WorkOrderActor,
  workOrderId: string,
  damageId: string,
  evidenceId: string,
) {
  const now = new Date();
  await prisma.$transaction(
    async (tx) => {
      const checkIn = await lockCheckIn(
        tx,
        actor.companyId,
        workOrderId,
      );
      if (checkIn.status !== "DRAFT")
        throw new AppError(
          409,
          "CHECK_IN_NOT_EDITABLE",
          "Somente um Check-in em rascunho pode excluir evidências de avaria.",
        );
      const damage = await tx.checkInDamage.findFirst({
        where: {
          id: damageId,
          companyId: actor.companyId,
          checkInId: checkIn.id,
          workOrderId,
        },
        select: { id: true, location: true, damageType: true },
      });
      if (!damage)
        throw new AppError(
          404,
          "CHECK_IN_DAMAGE_NOT_FOUND",
          "Avaria não encontrada.",
        );
      const evidence = await tx.checkInDamageEvidenceAttachment.findFirst({
        where: {
          id: evidenceId,
          companyId: actor.companyId,
          checkInId: checkIn.id,
          damageId,
          deletedAt: null,
        },
        select: { id: true, fileAssetId: true },
      });
      if (!evidence)
        throw new AppError(
          404,
          "DAMAGE_EVIDENCE_NOT_FOUND",
          "Evidência de avaria não encontrada.",
        );
      const removed = await tx.checkInDamageEvidenceAttachment.updateMany({
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
          ownershipType: "CHECK_IN_DAMAGE",
          deletedAt: null,
        },
        data: { status: "DELETED", deletedAt: now },
      });
      if (!removed.count || !assetRemoved.count)
        throw new AppError(
          409,
          "DAMAGE_EVIDENCE_DELETE_CONFLICT",
          "A evidência foi alterada por outra operação.",
        );
      await tx.auditLog.create({
        data: {
          companyId: actor.companyId,
          branchId: checkIn.branchId,
          actorUserId: actor.userId,
          action: "DAMAGE_EVIDENCE_DELETE",
          entityType: "CheckInDamageEvidenceAttachment",
          entityId: evidence.id,
          metadata: {
            evidenceId: evidence.id,
            damageId,
            damageType: damage.damageType,
            location: damage.location,
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

async function findDamageContext(
  companyId: string,
  workOrderId: string,
  damageId: string,
) {
  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, companyId },
    select: {
      id: true,
      checkIn: {
        select: {
          id: true,
          status: true,
          damages: {
            where: { id: damageId, companyId, workOrderId },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!workOrder)
    throw new AppError(
      404,
      "WORK_ORDER_NOT_FOUND",
      "Ordem de Serviço não encontrada.",
    );
  if (!workOrder.checkIn)
    throw new AppError(404, "CHECK_IN_NOT_FOUND", "Check-in não encontrado.");
  if (!workOrder.checkIn.damages.length)
    throw new AppError(
      404,
      "CHECK_IN_DAMAGE_NOT_FOUND",
      "Avaria não encontrada.",
    );
  return { checkIn: workOrder.checkIn };
}

async function lockCheckIn(
  tx: Prisma.TransactionClient,
  companyId: string,
  workOrderId: string,
) {
  const rows = await tx.$queryRaw<
    Array<{ id: string; branchId: string; status: string }>
  >(PrismaRuntime.sql`
    SELECT ci."id", ci."branchId", ci."status"
    FROM "VehicleCheckIn" ci
    INNER JOIN "WorkOrder" wo
      ON wo."id" = ci."workOrderId" AND wo."companyId" = ci."companyId"
    WHERE wo."id" = ${workOrderId}::uuid
      AND wo."companyId" = ${companyId}::uuid
      AND ci."companyId" = ${companyId}::uuid
    FOR UPDATE OF ci
  `);
  const checkIn = rows[0];
  if (!checkIn)
    throw new AppError(404, "CHECK_IN_NOT_FOUND", "Check-in não encontrado.");
  return checkIn;
}

function publicDamageEvidence(row: {
  id: string;
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
    caption: row.caption,
    sequence: row.sequence,
    originalFilename: row.fileAsset.originalFilename,
    detectedMimeType: row.fileAsset.detectedMimeType,
    sizeBytes: Number(row.fileAsset.sizeBytes),
    createdAt: row.createdAt,
    uploader: row.createdBy,
  };
}
