import type { Request } from "express";
import { Router } from "express";
import { asyncHandler } from "../../lib/errors.js";
import { authenticate, requirePermission } from "../auth/auth.middleware.js";
import { requireModule } from "../platform/module-gate.js";
import {
  closeWorkOrderSchema,
  createCheckInSchema,
  createConcernSchema,
  createWorkOrderSchema,
  idempotencyKeySchema,
  listWorkOrdersSchema,
  updateCheckInSchema,
  workOrderIdSchema,
} from "./work-orders.schemas.js";
import * as service from "./work-orders.service.js";

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
  "/:id",
  requirePermission("work_orders.view"),
  asyncHandler(async (req, res) => {
    const { id } = workOrderIdSchema.parse(req.params);
    res.json({ workOrder: await service.getWorkOrder(req.auth!.companyId, id) });
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
