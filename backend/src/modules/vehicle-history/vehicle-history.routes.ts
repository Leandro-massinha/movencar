import type { Request } from "express";
import { Router } from "express";
import { asyncHandler } from "../../lib/errors.js";
import { authenticate, requirePermission } from "../auth/auth.middleware.js";
import {
  createHistoryEventSchema,
  historyEventParamsSchema,
  historyParamsSchema,
  listHistorySchema,
} from "./vehicle-history.schemas.js";
import * as service from "./vehicle-history.service.js";
import { requireModule } from "../platform/module-gate.js";
export const vehicleHistoryRouter = Router({ mergeParams: true });
vehicleHistoryRouter.use(authenticate);
vehicleHistoryRouter.use(requireModule("vehicles"));
const actor = (req: Request): service.HistoryActor => ({
  companyId: req.auth!.companyId,
  branchId: req.auth!.branchId,
  userId: req.auth!.userId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});
vehicleHistoryRouter.get(
  "/",
  requirePermission("vehicle_history.view"),
  asyncHandler(async (req, res) => {
    const { vehicleId } = historyParamsSchema.parse(req.params);
    res.json(
      await service.listHistory(
        req.auth!.companyId,
        vehicleId,
        listHistorySchema.parse(req.query),
      ),
    );
  }),
);
vehicleHistoryRouter.post(
  "/",
  requirePermission("vehicle_history.create"),
  asyncHandler(async (req, res) => {
    const { vehicleId } = historyParamsSchema.parse(req.params);
    res
      .status(201)
      .json({
        event: await service.createManualHistory(
          actor(req),
          vehicleId,
          createHistoryEventSchema.parse(req.body),
        ),
      });
  }),
);
vehicleHistoryRouter.get(
  "/:eventId",
  requirePermission("vehicle_history.view"),
  asyncHandler(async (req, res) => {
    const { vehicleId, eventId } = historyEventParamsSchema.parse(req.params);
    res.json({
      event: await service.getHistoryEvent(
        req.auth!.companyId,
        vehicleId,
        eventId,
      ),
    });
  }),
);
