import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { Prisma as PrismaRuntime } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import type { PrivateStorageProvider, StagedPrivateImage } from "../../lib/private-storage/index.js";
import { prisma } from "../../lib/prisma.js";
import { checkInEvidenceStorage } from "./check-in-evidence.service.js";
import type { ChecklistItemEvidenceFields } from "./checklist-item-evidence.schemas.js";
import type { WorkOrderActor } from "./work-orders.service.js";

export const MAX_CHECKLIST_ITEM_EVIDENCE = 10;

const evidenceSelect = {
  id: true, caption: true, sequence: true, createdAt: true,
  createdBy: { select: { id: true, name: true } },
  fileAsset: { select: { originalFilename: true, detectedMimeType: true, sizeBytes: true } },
} satisfies Prisma.ChecklistItemEvidenceAttachmentSelect;

export async function assertChecklistItemEvidenceUploadAllowed(actor: WorkOrderActor, workOrderId: string, itemResultId: string) {
  const context = await findContext(actor.companyId, workOrderId, itemResultId);
  if (context.checkIn.status !== "DRAFT" || context.instance.status !== "DRAFT")
    throw new AppError(409, "CHECKLIST_NOT_EDITABLE", "Somente uma Lista de Verificação em rascunho pode receber fotos.");
}

export async function createChecklistItemEvidence(
  actor: WorkOrderActor, workOrderId: string, itemResultId: string,
  fields: ChecklistItemEvidenceFields, staged: StagedPrivateImage,
  storage: PrivateStorageProvider = checkInEvidenceStorage,
) {
  const fileAssetId = randomUUID();
  let promoted = false;
  let pendingCreated = false;
  try {
    await prisma.fileAsset.create({ data: {
      id: fileAssetId, companyId: actor.companyId, storageProvider: "LOCAL_PRIVATE",
      storageKey: staged.storageKey, originalFilename: staged.originalFilename,
      declaredMimeType: staged.declaredMimeType, detectedMimeType: staged.detectedMimeType,
      canonicalExtension: staged.canonicalExtension, sizeBytes: BigInt(staged.size),
      sha256: staged.sha256, status: "PENDING", ownershipType: "CHECKLIST_ITEM",
      uploadedByUserId: actor.userId,
    } });
    pendingCreated = true;
    try { await storage.promote(staged.stagingKey, staged.storageKey); }
    catch { throw new AppError(503, "PRIVATE_STORAGE_PROMOTION_FAILED", "Não foi possível armazenar a evidência com segurança."); }
    promoted = true;
    const row = await prisma.$transaction(async (tx) => {
      const context = await lockAndFindContext(tx, actor.companyId, workOrderId, itemResultId);
      if (context.status !== "DRAFT")
        throw new AppError(409, "CHECKLIST_NOT_EDITABLE", "Somente uma Lista de Verificação em rascunho pode receber fotos.");
      const count = await tx.checklistItemEvidenceAttachment.count({ where: {
        companyId: actor.companyId, itemResultId, deletedAt: null,
      } });
      if (count >= MAX_CHECKLIST_ITEM_EVIDENCE)
        throw new AppError(409, "CHECKLIST_ITEM_EVIDENCE_LIMIT_REACHED", `O item atingiu o limite de ${MAX_CHECKLIST_ITEM_EVIDENCE} fotos.`);
      const aggregate = await tx.checklistItemEvidenceAttachment.aggregate({
        where: { companyId: actor.companyId, itemResultId }, _max: { sequence: true },
      });
      const evidence = await tx.checklistItemEvidenceAttachment.create({ data: {
        companyId: actor.companyId, checkInId: context.checkInId,
        checklistInstanceId: context.instanceId, checklistItemId: context.itemId,
        itemResultId, fileAssetId, caption: fields.caption,
        sequence: (aggregate._max.sequence ?? 0) + 1, createdByUserId: actor.userId,
      }, select: evidenceSelect });
      const available = await tx.fileAsset.updateMany({ where: {
        id: fileAssetId, companyId: actor.companyId, status: "PENDING", ownershipType: "CHECKLIST_ITEM",
      }, data: { status: "AVAILABLE", availableAt: new Date() } });
      if (!available.count) throw new AppError(409, "FILE_ASSET_NOT_PENDING", "A evidência não está disponível para conclusão.");
      await tx.auditLog.create({ data: {
        companyId: actor.companyId, branchId: context.branchId, actorUserId: actor.userId,
        action: "CHECKLIST_ITEM_EVIDENCE_UPLOAD", entityType: "ChecklistItemEvidenceAttachment", entityId: evidence.id,
        metadata: { evidenceId: evidence.id, itemResultId, checklistItemId: context.itemId,
          itemLabel: context.itemTitle, workOrderId, checkInId: context.checkInId,
          sizeBytes: staged.size, detectedMimeType: staged.detectedMimeType },
        ipAddress: actor.ipAddress, userAgent: actor.userAgent,
      } });
      return evidence;
    }, { maxWait: 30_000, timeout: 15_000 });
    return publicEvidence(row);
  } catch (error) {
    await storage.remove(promoted ? staged.storageKey : staged.stagingKey).catch(() => undefined);
    if (pendingCreated) await prisma.fileAsset.updateMany({ where: {
      id: fileAssetId, companyId: actor.companyId, status: "PENDING",
    }, data: { status: "FAILED" } }).catch(() => undefined);
    if (error instanceof PrismaRuntime.PrismaClientKnownRequestError && error.code === "P2002")
      throw new AppError(409, "CHECKLIST_ITEM_EVIDENCE_CONFLICT", "Outra foto foi registrada ao mesmo tempo. Tente novamente.");
    throw error;
  }
}

export async function listChecklistItemEvidence(companyId: string, workOrderId: string, itemResultId: string) {
  await findContext(companyId, workOrderId, itemResultId);
  const rows = await prisma.checklistItemEvidenceAttachment.findMany({ where: {
    companyId, itemResultId, deletedAt: null, fileAsset: { status: "AVAILABLE", deletedAt: null },
  }, select: evidenceSelect, orderBy: [{ sequence: "asc" }, { createdAt: "asc" }, { id: "asc" }] });
  return rows.map(publicEvidence);
}

export async function openChecklistItemEvidenceContent(
  companyId: string, workOrderId: string, itemResultId: string, evidenceId: string,
  storage: PrivateStorageProvider = checkInEvidenceStorage,
) {
  await findContext(companyId, workOrderId, itemResultId);
  const evidence = await prisma.checklistItemEvidenceAttachment.findFirst({ where: {
    id: evidenceId, companyId, itemResultId, deletedAt: null,
  }, select: { fileAsset: { select: { storageKey: true, originalFilename: true,
    detectedMimeType: true, sizeBytes: true, status: true, deletedAt: true } } } });
  if (!evidence) throw new AppError(404, "CHECKLIST_ITEM_EVIDENCE_NOT_FOUND", "Evidência do item não encontrada.");
  const asset = evidence.fileAsset;
  if (asset.status !== "AVAILABLE" || asset.deletedAt)
    throw new AppError(409, "CHECKLIST_ITEM_EVIDENCE_UNAVAILABLE", "O arquivo da evidência não está disponível.");
  try {
    if (!(await storage.exists(asset.storageKey))) throw new AppError(409, "CHECKLIST_ITEM_EVIDENCE_FILE_MISSING", "O arquivo físico da evidência não foi encontrado.");
    const info = await storage.stat(asset.storageKey);
    if (BigInt(info.size) !== asset.sizeBytes) throw new AppError(409, "CHECKLIST_ITEM_EVIDENCE_FILE_INVALID", "O arquivo físico da evidência está inconsistente.");
    return { asset, stream: await storage.open(asset.storageKey) };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, "PRIVATE_STORAGE_UNAVAILABLE", "O armazenamento privado está temporariamente indisponível.");
  }
}

export async function deleteChecklistItemEvidence(actor: WorkOrderActor, workOrderId: string, itemResultId: string, evidenceId: string) {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const context = await lockAndFindContext(tx, actor.companyId, workOrderId, itemResultId);
    if (context.status !== "DRAFT") throw new AppError(409, "CHECKLIST_NOT_EDITABLE", "Somente uma Lista de Verificação em rascunho pode excluir fotos.");
    const evidence = await tx.checklistItemEvidenceAttachment.findFirst({ where: {
      id: evidenceId, companyId: actor.companyId, itemResultId, deletedAt: null,
    }, select: { id: true, fileAssetId: true } });
    if (!evidence) throw new AppError(404, "CHECKLIST_ITEM_EVIDENCE_NOT_FOUND", "Evidência do item não encontrada.");
    const removed = await tx.checklistItemEvidenceAttachment.updateMany({ where: {
      id: evidenceId, companyId: actor.companyId, deletedAt: null,
    }, data: { deletedAt: now } });
    const assetRemoved = await tx.fileAsset.updateMany({ where: {
      id: evidence.fileAssetId, companyId: actor.companyId, status: "AVAILABLE",
      ownershipType: "CHECKLIST_ITEM", deletedAt: null,
    }, data: { status: "DELETED", deletedAt: now } });
    if (!removed.count || !assetRemoved.count) throw new AppError(409, "CHECKLIST_ITEM_EVIDENCE_DELETE_CONFLICT", "A evidência foi alterada por outra operação.");
    await tx.auditLog.create({ data: {
      companyId: actor.companyId, branchId: context.branchId, actorUserId: actor.userId,
      action: "CHECKLIST_ITEM_EVIDENCE_DELETE", entityType: "ChecklistItemEvidenceAttachment", entityId: evidenceId,
      metadata: { evidenceId, itemResultId, checklistItemId: context.itemId,
        itemLabel: context.itemTitle, workOrderId, checkInId: context.checkInId },
      ipAddress: actor.ipAddress, userAgent: actor.userAgent,
    } });
  }, { maxWait: 30_000, timeout: 15_000 });
}

async function findContext(companyId: string, workOrderId: string, itemResultId: string) {
  const result = await prisma.checklistItemResult.findFirst({ where: {
    id: itemResultId, companyId, instance: { workOrderId, companyId },
  }, select: { itemId: true, instance: { select: { id: true, status: true,
    checkIn: { select: { id: true, status: true, branchId: true } } } }, item: { select: { title: true } } } });
  if (!result) throw new AppError(404, "CHECKLIST_ITEM_RESULT_NOT_FOUND", "Resposta da Lista de Verificação não encontrada.");
  return { instance: result.instance, checkIn: result.instance.checkIn };
}

async function lockAndFindContext(tx: Prisma.TransactionClient, companyId: string, workOrderId: string, itemResultId: string) {
  const rows = await tx.$queryRaw<Array<{ instanceId: string; checkInId: string; branchId: string; status: string; itemId: string; itemTitle: string }>>(PrismaRuntime.sql`
    SELECT ci."id" AS "instanceId", vc."id" AS "checkInId", vc."branchId", ci."status", r."itemId", i."title" AS "itemTitle"
    FROM "ChecklistInstance" ci
    JOIN "VehicleCheckIn" vc ON vc."id" = ci."checkInId" AND vc."companyId" = ci."companyId"
    JOIN "ChecklistItemResult" r ON r."instanceId" = ci."id" AND r."companyId" = ci."companyId"
    JOIN "ChecklistTemplateItem" i ON i."id" = r."itemId"
    WHERE r."id" = ${itemResultId}::uuid AND ci."workOrderId" = ${workOrderId}::uuid AND ci."companyId" = ${companyId}::uuid
    FOR UPDATE OF ci
  `);
  const context = rows[0];
  if (!context) throw new AppError(404, "CHECKLIST_ITEM_RESULT_NOT_FOUND", "Resposta da Lista de Verificação não encontrada.");
  return context;
}

function publicEvidence(row: { id: string; caption: string | null; sequence: number; createdAt: Date;
  createdBy: { id: string; name: string }; fileAsset: { originalFilename: string; detectedMimeType: string; sizeBytes: bigint } }) {
  return { id: row.id, caption: row.caption, sequence: row.sequence,
    originalFilename: row.fileAsset.originalFilename, detectedMimeType: row.fileAsset.detectedMimeType,
    sizeBytes: Number(row.fileAsset.sizeBytes), createdAt: row.createdAt, uploader: row.createdBy };
}
