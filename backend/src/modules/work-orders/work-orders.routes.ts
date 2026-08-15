import type { Request } from "express";
import { Router } from "express";
import { pipeline } from "node:stream/promises";
import { asyncHandler } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import { authenticate, requirePermission } from "../auth/auth.middleware.js";
import { requireModule } from "../platform/module-gate.js";
import {
  closeWorkOrderSchema,
  checklistResultParamsSchema,
  checklistResultSchema,
  createCheckInSchema,
  createConcernSchema,
  createDamageSchema,
  createPdcSchema,
  findingParamsSchema,
  createWorkOrderSchema,
  idempotencyKeySchema,
  listWorkOrdersSchema,
  pdcFindingSchema,
  updatePdcSchema,
  updateCheckInSchema,
  workOrderIdSchema,
} from "./work-orders.schemas.js";
import * as service from "./work-orders.service.js";
import * as evidenceService from "./check-in-evidence.service.js";
import { parseAndStageCheckInEvidence } from "./check-in-evidence.multipart.js";
import { checkInEvidenceParamsSchema } from "./check-in-evidence.schemas.js";

export const workOrdersRouter = Router();
workOrdersRouter.use(authenticate);
workOrdersRouter.use(requireModule("workshop"));

const actor = (req: Request): service.WorkOrderActor => ({
  companyId: req.auth!.companyId,
  branchId: req.auth!.branchId,
  userId: req.auth!.userId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});

workOrdersRouter.get(
  "/",
  requirePermission("work_orders.view"),
  asyncHandler(async (req, res) =>
    res.json(
      await service.listWorkOrders(
        req.auth!.companyId,
        listWorkOrdersSchema.parse(req.query),
      ),
    ),
  ),
);
workOrdersRouter.post(
  "/",
  requirePermission("work_orders.create"),
  asyncHandler(async (req, res) =>
    res.status(201).json({
      workOrder: await service.createWorkOrder(
        actor(req),
        createWorkOrderSchema.parse(req.body),
        idempotencyKeySchema.parse(req.get("idempotency-key")),
      ),
    }),
  ),
);
workOrdersRouter.get(
  "/:id/check-in/evidence",
  requirePermission("checkins.view"),
  asyncHandler(async (req, res) => {
    const { id } = workOrderIdSchema.parse(req.params);
    res.json({
      data: await evidenceService.listCheckInEvidence(req.auth!.companyId, id),
    });
  }),
);
workOrdersRouter.post(
  "/:id/check-in/evidence",
  requirePermission("checkins.update"),
  asyncHandler(async (req, res) => {
    const { id } = workOrderIdSchema.parse(req.params);
    await evidenceService.assertCheckInEvidenceUploadAllowed(actor(req), id);
    const upload = await parseAndStageCheckInEvidence(
      req,
      evidenceService.checkInEvidenceStorage,
      env.PHOTO_MAX_BYTES,
    );
    res.status(201).json({
      evidence: await evidenceService.createCheckInEvidence(
        actor(req),
        id,
        upload.fields,
        upload.staged,
      ),
    });
  }),
);
workOrdersRouter.get(
  "/:id/check-in/evidence/:evidenceId/content",
  requirePermission("checkins.view"),
  asyncHandler(async (req, res) => {
    const { id, evidenceId } = checkInEvidenceParamsSchema.parse(req.params);
    const { asset, stream } = await evidenceService.openCheckInEvidenceContent(
      req.auth!.companyId,
      id,
      evidenceId,
    );
    res.set({
      "Content-Type": asset.detectedMimeType,
      "Content-Length": String(asset.sizeBytes),
      "Content-Disposition": contentDisposition(asset.originalFilename),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    await pipeline(stream, res);
  }),
);
workOrdersRouter.delete(
  "/:id/check-in/evidence/:evidenceId",
  requirePermission("checkins.update"),
  asyncHandler(async (req, res) => {
    const { id, evidenceId } = checkInEvidenceParamsSchema.parse(req.params);
    await evidenceService.deleteCheckInEvidence(actor(req), id, evidenceId);
    res.status(204).end();
  }),
);
workOrdersRouter.get(
  "/:id/check-in/workspace",
  requirePermission("checkins.view"),
  asyncHandler(async (req, res) => {
    const { id } = workOrderIdSchema.parse(req.params);
    res.json(await service.getCheckInWorkspace(req.auth!.companyId, id));
  }),
);
workOrdersRouter.put(
  "/:id/check-in/checklist/items/:itemId",
  requirePermission("checkins.update"),
  asyncHandler(async (req, res) => {
    const { id, itemId } = checklistResultParamsSchema.parse(req.params);
    res.json({
      result: await service.saveChecklistResult(
        actor(req),
        id,
        itemId,
        checklistResultSchema.parse(req.body),
      ),
    });
  }),
);
workOrdersRouter.post(
  "/:id/check-in/damages",
  requirePermission("checkins.update"),
  asyncHandler(async (req, res) => {
    const { id } = workOrderIdSchema.parse(req.params);
    res
      .status(201)
      .json({
        damage: await service.createDamage(
          actor(req),
          id,
          createDamageSchema.parse(req.body),
          idempotencyKeySchema.parse(req.get("idempotency-key")),
        ),
      });
  }),
);

export function contentDisposition(filename: string): string {
  const safeAscii = filename
    .replace(/[^\x20-\x7e]/gu, "_")
    .replace(/["\\]/gu, "_")
    .slice(0, 180) || "evidencia";
  const encoded = encodeURIComponent(filename).replace(
    /[!'()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${safeAscii}"; filename*=UTF-8''${encoded}`;
}
workOrdersRouter.get(
  "/:id/pdc",
  requirePermission("pdc.view"),
  asyncHandler(async (req, res) => {
    const { id } = workOrderIdSchema.parse(req.params);
    res.json(await service.getPdcWorkspace(req.auth!.companyId, id));
  }),
);
workOrdersRouter.post(
  "/:id/pdc",
  requirePermission("pdc.create"),
  asyncHandler(async (req, res) => {
    const { id } = workOrderIdSchema.parse(req.params);
    res
      .status(201)
      .json({
        pdc: await service.createPdc(
          actor(req),
          id,
          createPdcSchema.parse(req.body),
          idempotencyKeySchema.parse(req.get("idempotency-key")),
        ),
      });
  }),
);
workOrdersRouter.patch(
  "/:id/pdc",
  requirePermission("pdc.update"),
  asyncHandler(async (req, res) => {
    const { id } = workOrderIdSchema.parse(req.params);
    res.json({
      pdc: await service.updatePdc(
        actor(req),
        id,
        updatePdcSchema.parse(req.body),
      ),
    });
  }),
);
workOrdersRouter.post(
  "/:id/pdc/findings",
  requirePermission("pdc.update"),
  asyncHandler(async (req, res) => {
    const { id } = workOrderIdSchema.parse(req.params);
    res
      .status(201)
      .json({
        finding: await service.createPdcFinding(
          actor(req),
          id,
          pdcFindingSchema.parse(req.body),
        ),
      });
  }),
);
workOrdersRouter.put(
  "/:id/pdc/findings/:findingId",
  requirePermission("pdc.update"),
  asyncHandler(async (req, res) => {
    const { id, findingId } = findingParamsSchema.parse(req.params);
    res.json({
      finding: await service.updatePdcFinding(
        actor(req),
        id,
        findingId,
        pdcFindingSchema.parse(req.body),
      ),
    });
  }),
);
workOrdersRouter.post(
  "/:id/pdc/complete",
  requirePermission("pdc.complete"),
  asyncHandler(async (req, res) => {
    const { id } = workOrderIdSchema.parse(req.params);
    res.json({ pdc: await service.completePdc(actor(req), id) });
  }),
);
workOrdersRouter.get(
  "/:id",
  requirePermission("work_orders.view"),
  asyncHandler(async (req, res) => {
    const { id } = workOrderIdSchema.parse(req.params);
    res.json({
      workOrder: await service.getWorkOrder(req.auth!.companyId, id),
    });
  }),
);
workOrdersRouter.post(
  "/:id/close",
  requirePermission("work_orders.close"),
  asyncHandler(async (req, res) => {
    const { id } = workOrderIdSchema.parse(req.params);
    res.json({
      workOrder: await service.closeWorkOrder(
        actor(req),
        id,
        closeWorkOrderSchema.parse(req.body),
      ),
    });
  }),
);
workOrdersRouter.get(
  "/:id/concerns",
  requirePermission("work_orders.view"),
  asyncHandler(async (req, res) => {
    const { id } = workOrderIdSchema.parse(req.params);
    res.json({ data: await service.listConcerns(req.auth!.companyId, id) });
  }),
);
workOrdersRouter.post(
  "/:id/concerns",
  requirePermission("customer_concerns.create"),
  asyncHandler(async (req, res) => {
    const { id } = workOrderIdSchema.parse(req.params);
    res.status(201).json({
      concern: await service.createConcern(
        actor(req),
        id,
        createConcernSchema.parse(req.body),
      ),
    });
  }),
);
workOrdersRouter.get(
  "/:id/check-in",
  requirePermission("checkins.view"),
  asyncHandler(async (req, res) => {
    const { id } = workOrderIdSchema.parse(req.params);
    res.json({ checkIn: await service.getCheckIn(req.auth!.companyId, id) });
  }),
);
workOrdersRouter.post(
  "/:id/check-in",
  requirePermission("checkins.create"),
  asyncHandler(async (req, res) => {
    const { id } = workOrderIdSchema.parse(req.params);
    res.status(201).json({
      checkIn: await service.createCheckIn(
        actor(req),
        id,
        createCheckInSchema.parse(req.body),
      ),
    });
  }),
);
workOrdersRouter.patch(
  "/:id/check-in",
  requirePermission("checkins.update"),
  asyncHandler(async (req, res) => {
    const { id } = workOrderIdSchema.parse(req.params);
    res.json({
      checkIn: await service.updateCheckIn(
        actor(req),
        id,
        updateCheckInSchema.parse(req.body),
      ),
    });
  }),
);
workOrdersRouter.post(
  "/:id/check-in/complete",
  requirePermission("checkins.complete"),
  asyncHandler(async (req, res) => {
    const { id } = workOrderIdSchema.parse(req.params);
    res.json({ checkIn: await service.completeCheckIn(actor(req), id) });
  }),
);
