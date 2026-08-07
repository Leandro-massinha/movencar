import type { Request } from "express";
import { Router } from "express";
import { asyncHandler } from "../../lib/errors.js";
import { authenticate, requirePermission } from "../auth/auth.middleware.js";
import {
  createVehicleSchema,
  listVehiclesSchema,
  updateVehicleSchema,
  vehicleIdSchema,
} from "./vehicles.schemas.js";
import * as service from "./vehicles.service.js";
import { requireModule } from "../platform/module-gate.js";

export const vehiclesRouter = Router();
vehiclesRouter.use(authenticate);
vehiclesRouter.use(requireModule("vehicles"));
const actor = (req: Request): service.VehicleActor => ({
  companyId: req.auth!.companyId,
  branchId: req.auth!.branchId,
  userId: req.auth!.userId,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});
vehiclesRouter.get(
  "/",
  requirePermission("vehicles.view"),
  asyncHandler(async (req, res) =>
    res.json(
      await service.listVehicles(
        req.auth!.companyId,
        listVehiclesSchema.parse(req.query),
      ),
    ),
  ),
);
vehiclesRouter.get(
  "/:id",
  requirePermission("vehicles.view"),
  asyncHandler(async (req, res) => {
    const { id } = vehicleIdSchema.parse(req.params);
    res.json({ vehicle: await service.getVehicle(req.auth!.companyId, id) });
  }),
);
vehiclesRouter.post(
  "/",
  requirePermission("vehicles.create"),
  asyncHandler(async (req, res) =>
    res
      .status(201)
      .json({
        vehicle: await service.createVehicle(
          actor(req),
          createVehicleSchema.parse(req.body),
        ),
      }),
  ),
);
vehiclesRouter.patch(
  "/:id",
  requirePermission("vehicles.update"),
  asyncHandler(async (req, res) => {
    const { id } = vehicleIdSchema.parse(req.params);
    res.json({
      vehicle: await service.updateVehicle(
        actor(req),
        id,
        updateVehicleSchema.parse(req.body),
      ),
    });
  }),
);
vehiclesRouter.delete(
  "/:id",
  requirePermission("vehicles.delete"),
  asyncHandler(async (req, res) => {
    const { id } = vehicleIdSchema.parse(req.params);
    await service.deleteVehicle(actor(req), id);
    res.status(204).send();
  }),
);
