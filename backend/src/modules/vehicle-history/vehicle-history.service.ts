import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import type {
  CreateHistoryEventInput,
  ListHistoryInput,
} from "./vehicle-history.schemas.js";

export type HistoryActor = {
  companyId: string;
  branchId: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
};
const eventSelect = {
  id: true,
  eventType: true,
  title: true,
  description: true,
  mileage: true,
  eventDate: true,
  isManual: true,
  createdAt: true,
  branch: { select: { name: true } },
  actor: { select: { name: true } },
} satisfies Prisma.VehicleHistoryEventSelect;
async function assertVehicle(companyId: string, vehicleId: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!vehicle)
    throw new AppError(404, "VEHICLE_NOT_FOUND", "Veículo não encontrado.");
}
async function assertBranch(companyId: string, branchId?: string | null) {
  if (!branchId) return;
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });
  if (!branch)
    throw new AppError(404, "BRANCH_NOT_FOUND", "Filial não encontrada.");
}
export async function listHistory(
  companyId: string,
  vehicleId: string,
  input: ListHistoryInput,
) {
  await assertVehicle(companyId, vehicleId);
  const where: Prisma.VehicleHistoryEventWhereInput = {
    companyId,
    vehicleId,
    eventType: input.eventType,
    eventDate:
      input.dateFrom || input.dateTo
        ? { gte: input.dateFrom, lte: input.dateTo }
        : undefined,
  };
  const [data, total] = await prisma.$transaction([
    prisma.vehicleHistoryEvent.findMany({
      where,
      select: eventSelect,
      orderBy: [{ eventDate: input.sortOrder }, { createdAt: input.sortOrder }],
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.vehicleHistoryEvent.count({ where }),
  ]);
  return {
    data,
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}
export async function getHistoryEvent(
  companyId: string,
  vehicleId: string,
  eventId: string,
) {
  await assertVehicle(companyId, vehicleId);
  const event = await prisma.vehicleHistoryEvent.findFirst({
    where: { id: eventId, vehicleId, companyId },
    select: eventSelect,
  });
  if (!event)
    throw new AppError(
      404,
      "VEHICLE_HISTORY_NOT_FOUND",
      "Evento do histórico não encontrado.",
    );
  return event;
}
export async function createManualHistory(
  actor: HistoryActor,
  vehicleId: string,
  input: CreateHistoryEventInput,
) {
  const branchId =
    input.branchId === undefined ? actor.branchId : input.branchId;
  await assertVehicle(actor.companyId, vehicleId);
  await assertBranch(actor.companyId, branchId);
  return prisma.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.findFirst({
      where: { id: vehicleId, companyId: actor.companyId, deletedAt: null },
      select: { id: true, currentMileage: true },
    });
    if (!vehicle)
      throw new AppError(404, "VEHICLE_NOT_FOUND", "Veículo não encontrado.");
    const event = await tx.vehicleHistoryEvent.create({
      data: {
        companyId: actor.companyId,
        vehicleId,
        branchId,
        actorUserId: actor.userId,
        eventType: input.eventType,
        sourceType: "MANUAL",
        title: input.title,
        description: input.description,
        mileage: input.mileage,
        eventDate: input.eventDate ?? new Date(),
        isManual: true,
      },
      select: eventSelect,
    });
    if (
      input.mileage != null &&
      (vehicle.currentMileage == null || input.mileage > vehicle.currentMileage)
    )
      await tx.vehicle.updateMany({
        where: {
          id: vehicleId,
          companyId: actor.companyId,
          deletedAt: null,
          OR: [
            { currentMileage: null },
            { currentMileage: { lt: input.mileage } },
          ],
        },
        data: { currentMileage: input.mileage },
      });
    await tx.auditLog.create({
      data: {
        companyId: actor.companyId,
        branchId: actor.branchId,
        actorUserId: actor.userId,
        action: "VEHICLE_HISTORY_CREATE",
        entityType: "VehicleHistoryEvent",
        entityId: event.id,
        metadata: {
          vehicleId,
          eventType: event.eventType,
          mileage: event.mileage,
        },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      },
    });
    return event;
  });
}
