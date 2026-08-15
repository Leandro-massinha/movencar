import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalPrivateStorageProvider } from "../src/lib/private-storage/index.js";
import { prisma } from "../src/lib/prisma.js";
import { createChecklistItemEvidence, deleteChecklistItemEvidence, listChecklistItemEvidence, MAX_CHECKLIST_ITEM_EVIDENCE } from "../src/modules/work-orders/checklist-item-evidence.service.js";
import { completeCheckIn, saveChecklistResult, type WorkOrderActor } from "../src/modules/work-orders/work-orders.service.js";

const suite = process.env.CHECKLIST_ITEM_EVIDENCE_DATABASE_TESTS === "1" ? describe : describe.skip;
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

suite("regras obrigatórias e evidências de item no PostgreSQL", () => {
  const companyId = randomUUID(), otherCompanyId = randomUUID();
  const branchId = randomUUID(), otherBranchId = randomUUID();
  const userId = randomUUID(), otherUserId = randomUUID();
  const customerId = randomUUID(), vehicleId = randomUUID();
  const actor: WorkOrderActor = { companyId, branchId, userId };
  let templateId: string, noRuleId: string, alwaysId: string, issueId: string;
  let root: string, storage: LocalPrivateStorageProvider, number = 9000;

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "movencar-checklist-item-evidence-"));
    storage = new LocalPrivateStorageProvider({ root, maxBytes: 1024 });
    for (const [company, branch, user, suffix] of [[companyId, branchId, userId, "A"], [otherCompanyId, otherBranchId, otherUserId, "B"]] as const) {
      await prisma.company.create({ data: { id: company, code: `foto-item-${suffix}-${company}`, legalName: `Empresa ${suffix}`, tradeName: `Empresa ${suffix}` } });
      await prisma.branch.create({ data: { id: branch, companyId: company, code: suffix, name: `Filial ${suffix}` } });
      await prisma.user.create({ data: { id: user, companyId: company, defaultBranchId: branch, name: `Usuário ${suffix}`, email: `${user}@example.invalid`, passwordHash: "x" } });
    }
    await prisma.customer.create({ data: { id: customerId, companyId, name: "Cliente" } });
    await prisma.vehicle.create({ data: { id: vehicleId, companyId, customerId, brand: "Marca", model: "Modelo" } });
    const template = await prisma.checklistTemplate.create({ data: { companyId, name: "Fotos obrigatórias", type: "CHECK_IN", version: 1, isDefault: true,
      sections: { create: { title: "Inspeção", order: 1, items: { create: [
        { title: "Sem regra", responseType: "STATUS", order: 1, isRequired: true },
        { title: "Foto sempre", responseType: "STATUS", order: 2, isRequired: true, requiresPhoto: true },
        { title: "Foto no problema", responseType: "STATUS", order: 3, isRequired: true, photoRequiredOnIssue: true },
      ] } } } }, include: { sections: { include: { items: true } } } });
    templateId = template.id;
    [noRuleId, alwaysId, issueId] = template.sections[0].items.sort((a, b) => a.order - b.order).map(({ id }) => id);
  });
  afterAll(async () => { await prisma.$disconnect(); await rm(root, { recursive: true, force: true }); });

  it("mantém itens sem regra e normal condicional compatíveis, mas bloqueia requiresPhoto", async () => {
    const context = await createContext("ISSUE", "OK", "OK");
    await expect(completeCheckIn(actor, context.workOrderId)).rejects.toMatchObject({ code: "CHECKLIST_PHOTO_REQUIRED", details: { items: [expect.objectContaining({ itemId: alwaysId, reason: "REQUIRES_PHOTO" })] } });
    await addPhoto(context.workOrderId, context.results[alwaysId]);
    await expect(completeCheckIn(actor, context.workOrderId)).resolves.toBeDefined();
  });

  it("aplica regra somente a ISSUE e reage à mudança de resposta", async () => {
    const context = await createContext("OK", "OK", "OK");
    await addPhoto(context.workOrderId, context.results[alwaysId]);
    await saveChecklistResult(actor, context.workOrderId, issueId, { status: "ISSUE" });
    await expect(completeCheckIn(actor, context.workOrderId)).rejects.toMatchObject({ code: "CHECKLIST_PHOTO_REQUIRED", details: { items: [expect.objectContaining({ reason: "PHOTO_REQUIRED_ON_ISSUE" })] } });
    await saveChecklistResult(actor, context.workOrderId, issueId, { status: "OK" });
    await expect(completeCheckIn(actor, context.workOrderId)).resolves.toBeDefined();
  });

  it.each(["PENDING", "FAILED", "DELETED"] as const)("não aceita asset %s para conclusão", async (status) => {
    const context = await createContext("OK", "OK", "OK");
    await attachAsset(context, context.results[alwaysId], status, false);
    await expect(completeCheckIn(actor, context.workOrderId)).rejects.toMatchObject({ code: "CHECKLIST_PHOTO_REQUIRED" });
  });

  it("não aceita attachment soft deleted, permite excluir a última foto e volta a bloquear", async () => {
    const alreadyDeleted = await createContext("OK", "OK", "OK");
    await attachAsset(alreadyDeleted, alreadyDeleted.results[alwaysId], "AVAILABLE", true);
    await expect(completeCheckIn(actor, alreadyDeleted.workOrderId)).rejects.toMatchObject({ code: "CHECKLIST_PHOTO_REQUIRED" });

    const context = await createContext("OK", "OK", "OK");
    const photo = await addPhoto(context.workOrderId, context.results[alwaysId]);
    await deleteChecklistItemEvidence(actor, context.workOrderId, context.results[alwaysId], photo.id);
    expect(await listChecklistItemEvidence(companyId, context.workOrderId, context.results[alwaysId])).toEqual([]);
    await expect(completeCheckIn(actor, context.workOrderId)).rejects.toMatchObject({ code: "CHECKLIST_PHOTO_REQUIRED" });
    expect(await prisma.auditLog.count({ where: { entityId: photo.id, action: "CHECKLIST_ITEM_EVIDENCE_UPLOAD" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entityId: photo.id, action: "CHECKLIST_ITEM_EVIDENCE_DELETE" } })).toBe(1);
  });

  it("isola tenant, limita 10 e serializa uploads", async () => {
    const context = await createContext("OK", "OK", "OK");
    await expect(listChecklistItemEvidence(otherCompanyId, context.workOrderId, context.results[alwaysId])).rejects.toMatchObject({ status: 404 });
    const [one, two] = await Promise.all([addPhoto(context.workOrderId, context.results[alwaysId]), addPhoto(context.workOrderId, context.results[alwaysId])]);
    expect([one.sequence, two.sequence].sort()).toEqual([1, 2]);
    for (let index = 2; index < MAX_CHECKLIST_ITEM_EVIDENCE; index++) await addPhoto(context.workOrderId, context.results[alwaysId]);
    const overflow = await stage(`limite-${randomUUID()}.jpg`);
    await expect(createChecklistItemEvidence(actor, context.workOrderId, context.results[alwaysId], {}, overflow, storage)).rejects.toMatchObject({ code: "CHECKLIST_ITEM_EVIDENCE_LIMIT_REACHED" });
    expect(await storage.exists(overflow.storageKey)).toBe(false);
  });

  it("mantém estado consistente em upload concorrente com conclusão", async () => {
    const context = await createContext("OK", "OK", "OK");
    const staged = await stage("corrida.jpg");
    const [upload, completion] = await Promise.allSettled([
      createChecklistItemEvidence(actor, context.workOrderId, context.results[alwaysId], {}, staged, storage),
      completeCheckIn(actor, context.workOrderId),
    ]);
    expect([upload.status, completion.status]).toContain("fulfilled");
    if (completion.status === "fulfilled") expect(upload.status).toBe("fulfilled");
    else expect(completion.reason).toMatchObject({ code: "CHECKLIST_PHOTO_REQUIRED" });
  });

  it("serializa exclusão e mudança de resposta com a conclusão", async () => {
    const deletion = await createContext("OK", "OK", "OK");
    const photo = await addPhoto(deletion.workOrderId, deletion.results[alwaysId]);
    const [removed, completed] = await Promise.allSettled([
      deleteChecklistItemEvidence(actor, deletion.workOrderId, deletion.results[alwaysId], photo.id),
      completeCheckIn(actor, deletion.workOrderId),
    ]);
    expect([removed.status, completed.status]).toContain("fulfilled");
    if (completed.status === "fulfilled") expect(removed.status).toBe("rejected");
    else expect(completed.reason).toMatchObject({ code: "CHECKLIST_PHOTO_REQUIRED" });

    const response = await createContext("OK", "OK", "OK");
    await addPhoto(response.workOrderId, response.results[alwaysId]);
    const [changed, responseCompletion] = await Promise.allSettled([
      saveChecklistResult(actor, response.workOrderId, issueId, { status: "ISSUE" }),
      completeCheckIn(actor, response.workOrderId),
    ]);
    expect([changed.status, responseCompletion.status]).toContain("fulfilled");
    if (changed.status === "fulfilled") expect(responseCompletion.status).toBe("rejected");
  });

  async function createContext(noRule: "OK" | "ISSUE", always: "OK" | "ISSUE", issue: "OK" | "ISSUE") {
    const workOrderId = randomUUID(), checkInId = randomUUID(), instanceId = randomUUID();
    await prisma.workOrder.create({ data: { id: workOrderId, companyId, branchId, customerId, vehicleId, attendantUserId: userId, number: number++, purpose: "INSPECTION" } });
    await prisma.vehicleCheckIn.create({ data: { id: checkInId, companyId, branchId, workOrderId, customerId, vehicleId, createdByUserId: userId } });
    await prisma.checklistInstance.create({ data: { id: instanceId, companyId, workOrderId, checkInId, templateId, templateVersion: 1, createdByUserId: userId } });
    const entries = [[noRuleId, noRule], [alwaysId, always], [issueId, issue]] as const;
    const results: Record<string, string> = {};
    for (const [itemId, status] of entries) {
      const row = await prisma.checklistItemResult.create({ data: { companyId, instanceId, itemId, status, completedByUserId: userId } });
      results[itemId] = row.id;
    }
    return { workOrderId, checkInId, instanceId, results };
  }
  async function stage(filename: string) { return storage.stage({ content: Readable.from([jpeg]), declaredMimeType: "image/jpeg", originalFilename: filename }); }
  async function addPhoto(workOrderId: string, resultId: string) { return createChecklistItemEvidence(actor, workOrderId, resultId, {}, await stage(`${randomUUID()}.jpg`), storage); }
  async function attachAsset(context: Awaited<ReturnType<typeof createContext>>, resultId: string, status: "PENDING" | "FAILED" | "AVAILABLE" | "DELETED", attachmentDeleted: boolean) {
    const assetId = randomUUID(), now = new Date();
    await prisma.fileAsset.create({ data: { id: assetId, companyId, storageKey: `objects/${assetId}.jpg`, originalFilename: "foto.jpg", declaredMimeType: "image/jpeg", detectedMimeType: "image/jpeg", canonicalExtension: "jpg", sizeBytes: BigInt(jpeg.length), sha256: "a".repeat(64), ownershipType: "CHECKLIST_ITEM", uploadedByUserId: userId, status, availableAt: status === "AVAILABLE" || status === "DELETED" ? now : null, deletedAt: status === "DELETED" ? now : null } });
    await prisma.checklistItemEvidenceAttachment.create({ data: { companyId, checkInId: context.checkInId, checklistInstanceId: context.instanceId, checklistItemId: alwaysId, itemResultId: resultId, fileAssetId: assetId, sequence: 1, createdByUserId: userId, deletedAt: attachmentDeleted ? now : null } });
  }
});
