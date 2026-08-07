import type { Prisma } from "@prisma/client";
import { Prisma as PrismaRuntime } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import type {
  CreateVehicleInput,
  ListVehicleRecordsInput,
  ListVehiclesInput,
  UpdateVehicleInput,
} from "./vehicles.schemas.js";

export type VehicleActor = {
  companyId: string;
  branchId: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
};
const vehicleSelect = {
  id: true,
  customerId: true,
  originBranchId: true,
  status: true,
  plate: true,
  renavam: true,
  chassis: true,
  brand: true,
  model: true,
  version: true,
  yearManufacture: true,
  yearModel: true,
  color: true,
  fuelType: true,
  transmission: true,
  engine: true,
  enginePower: true,
  bodyType: true,
  doors: true,
  currentMileage: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, name: true, document: true, phone: true } },
  originBranch: { select: { id: true, code: true, name: true } },
} satisfies Prisma.VehicleSelect;
const auditData = (
  actor: VehicleActor,
  action: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue,
) => ({
  companyId: actor.companyId,
  branchId: actor.branchId,
  actorUserId: actor.userId,
  action,
  entityType: "Vehicle",
  entityId,
  metadata,
  ipAddress: actor.ipAddress,
  userAgent: actor.userAgent,
});

async function assertCustomer(companyId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });
  if (!customer)
    throw new AppError(
      404,
      "CUSTOMER_NOT_FOUND",
      "Cliente não encontrado ou indisponível.",
    );
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
function handleConflict(error: unknown): never {
  if (
    error instanceof PrismaRuntime.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const target = String(
      (error.meta as { target?: unknown } | undefined)?.target ?? "",
    );
    if (target.toLowerCase().includes("ownership"))
      throw new AppError(
        409,
        "VEHICLE_OWNER_CONFLICT",
        "O proprietário do veículo foi alterado por outra operação. Atualize os dados e tente novamente.",
      );
    throw new AppError(
      409,
      target.toLowerCase().includes("chassis")
        ? "VEHICLE_CHASSIS_EXISTS"
        : "VEHICLE_PLATE_EXISTS",
      target.toLowerCase().includes("chassis")
        ? "Chassi ja cadastrado nesta empresa."
        : "Placa ja cadastrada nesta empresa.",
    );
  }
  throw error;
}

export async function listVehicles(
  companyId: string,
  input: ListVehiclesInput,
) {
  const normalized = input.search?.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const where: Prisma.VehicleWhereInput = {
    companyId,
    deletedAt: null,
    status: input.status,
    customerId: input.customerId,
    originBranchId: input.branchId,
    fuelType: input.fuelType,
    brand: input.brand
      ? { contains: input.brand, mode: "insensitive" }
      : undefined,
    model: input.model
      ? { contains: input.model, mode: "insensitive" }
      : undefined,
    ...(input.search
      ? {
          OR: [
            { plate: { contains: normalized || input.search } },
            { brand: { contains: input.search, mode: "insensitive" } },
            { model: { contains: input.search, mode: "insensitive" } },
            { version: { contains: input.search, mode: "insensitive" } },
            { chassis: { contains: normalized || input.search } },
            {
              renavam: {
                contains: input.search.replace(/\D/g, "") || input.search,
              },
            },
            {
              customer: {
                is: {
                  companyId,
                  deletedAt: null,
                  name: { contains: input.search, mode: "insensitive" },
                },
              },
            },
          ],
        }
      : {}),
  };
  const [data, total] = await prisma.$transaction([
    prisma.vehicle.findMany({
      where,
      select: vehicleSelect,
      orderBy: { [input.sortBy]: input.sortOrder },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.vehicle.count({ where }),
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
export async function getVehicle(companyId: string, id: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, companyId, deletedAt: null },
    select: vehicleSelect,
  });
  if (!vehicle)
    throw new AppError(404, "VEHICLE_NOT_FOUND", "Veículo não encontrado.");
  return vehicle;
}
export async function listVehicleOwnerships(
  companyId: string,
  vehicleId: string,
  input: ListVehicleRecordsInput,
) {
  await getVehicle(companyId, vehicleId);
  const where = { companyId, vehicleId };
  const [data, total] = await prisma.$transaction([
    prisma.vehicleOwnershipHistory.findMany({
      where,
      select: {
        id: true,
        ownershipType: true,
        validFrom: true,
        validUntil: true,
        isCurrent: true,
        notes: true,
        createdAt: true,
        customer: { select: { id: true, name: true, document: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.vehicleOwnershipHistory.count({ where }),
  ]);
  return {
    data,
    pagination: {
      ...input,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}
export async function listVehicleOdometerReadings(
  companyId: string,
  vehicleId: string,
  input: ListVehicleRecordsInput,
) {
  await getVehicle(companyId, vehicleId);
  const where = { companyId, vehicleId };
  const [data, total] = await prisma.$transaction([
    prisma.vehicleOdometerReading.findMany({
      where,
      select: {
        id: true,
        mileage: true,
        recordedAt: true,
        source: true,
        notes: true,
        createdAt: true,
        branch: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.vehicleOdometerReading.count({ where }),
  ]);
  return {
    data,
    pagination: {
      ...input,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}
export async function createVehicle(
  actor: VehicleActor,
  input: CreateVehicleInput,
) {
  await assertCustomer(actor.companyId, input.customerId);
  await assertBranch(actor.companyId, input.originBranchId);
  try {
    return await prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.create({
        data: { ...input, companyId: actor.companyId },
        select: vehicleSelect,
      });
      const now = new Date();
      await tx.vehicleOwnershipHistory.create({
        data: {
          companyId: actor.companyId,
          vehicleId: vehicle.id,
          customerId: vehicle.customerId,
          createdByUserId: actor.userId,
          ownershipType: "OWNER",
          validFrom: now,
          isCurrent: true,
        },
      });
      if (vehicle.currentMileage != null)
        await tx.vehicleOdometerReading.create({
          data: {
            companyId: actor.companyId,
            vehicleId: vehicle.id,
            branchId: actor.branchId,
            userId: actor.userId,
            mileage: vehicle.currentMileage,
            recordedAt: now,
            source: "VEHICLE",
            sourceId: vehicle.id,
          },
        });
      await tx.vehicleHistoryEvent.create({
        data: {
          companyId: actor.companyId,
          vehicleId: vehicle.id,
          branchId: actor.branchId,
          actorUserId: actor.userId,
          eventType: "VEHICLE_CREATED",
          sourceType: "VEHICLE",
          sourceId: vehicle.id,
          title: "Veículo cadastrado",
          description: `${vehicle.brand} ${vehicle.model}`,
          mileage: vehicle.currentMileage,
          eventDate: now,
          isManual: false,
        },
      });
      await tx.auditLog.create({
        data: auditData(actor, "VEHICLE_CREATE", vehicle.id, {
          customerId: vehicle.customerId,
          plate: vehicle.plate,
        }),
      });
      return vehicle;
    });
  } catch (error) {
    handleConflict(error);
  }
}
export async function updateVehicle(
  actor: VehicleActor,
  id: string,
  input: UpdateVehicleInput,
) {
  const current = await getVehicle(actor.companyId, id);
  if (
    input.currentMileage !== undefined &&
    current.currentMileage !== null &&
    (input.currentMileage === null ||
      input.currentMileage < current.currentMileage)
  ) {
    throw new AppError(
      400,
      "VEHICLE_MILEAGE_DECREASE",
      "A quilometragem atual do veículo não pode ser reduzida.",
    );
  }
  const fields = Object.keys(input).filter(
    (field) =>
      current[field as keyof typeof current] !==
      input[field as keyof UpdateVehicleInput],
  );
  if (!fields.length) return current;
  if (input.customerId) await assertCustomer(actor.companyId, input.customerId);
  await assertBranch(actor.companyId, input.originBranchId);
  try {
    return await prisma.$transaction(async (tx) => {
      const now = new Date();
      const changed = await tx.vehicle.updateMany({
        where: {
          id,
          companyId: actor.companyId,
          deletedAt: null,
          ...(typeof input.currentMileage === "number"
            ? {
                OR: [
                  { currentMileage: null },
                  { currentMileage: { lt: input.currentMileage } },
                ],
              }
            : {}),
        },
        data: input,
      });
      if (!changed.count) {
        const latest = await tx.vehicle.findFirst({
          where: { id, companyId: actor.companyId, deletedAt: null },
          select: vehicleSelect,
        });
        if (
          latest &&
          fields.length === 1 &&
          fields[0] === "currentMileage" &&
          latest.currentMileage === input.currentMileage
        )
          return latest;
        if (
          latest &&
          input.currentMileage !== undefined &&
          latest.currentMileage !== null &&
          (input.currentMileage === null ||
            input.currentMileage < latest.currentMileage)
        )
          throw new AppError(
            400,
            "VEHICLE_MILEAGE_DECREASE",
            "A quilometragem atual do veículo não pode ser reduzida.",
          );
        throw new AppError(404, "VEHICLE_NOT_FOUND", "Veículo não encontrado.");
      }
      const vehicle = await tx.vehicle.findFirstOrThrow({
        where: { id, companyId: actor.companyId, deletedAt: null },
        select: vehicleSelect,
      });
      if (input.customerId && input.customerId !== current.customerId) {
        await tx.vehicleOwnershipHistory.updateMany({
          where: {
            companyId: actor.companyId,
            vehicleId: id,
            ownershipType: "OWNER",
            isCurrent: true,
          },
          data: { isCurrent: false, validUntil: now },
        });
        await tx.vehicleOwnershipHistory.create({
          data: {
            companyId: actor.companyId,
            vehicleId: id,
            customerId: input.customerId,
            createdByUserId: actor.userId,
            ownershipType: "OWNER",
            validFrom: now,
            isCurrent: true,
          },
        });
      }
      if (typeof input.currentMileage === "number")
        await tx.vehicleOdometerReading.create({
          data: {
            companyId: actor.companyId,
            vehicleId: id,
            branchId: actor.branchId,
            userId: actor.userId,
            mileage: input.currentMileage,
            recordedAt: now,
            source: "VEHICLE",
            sourceId: id,
          },
        });
      await tx.vehicleHistoryEvent.create({
        data: {
          companyId: actor.companyId,
          vehicleId: id,
          branchId: actor.branchId,
          actorUserId: actor.userId,
          eventType:
            fields.includes("customerId")
              ? "OWNER_CHANGED"
              : fields.length === 1 && fields[0] === "currentMileage"
              ? "MILEAGE_RECORDED"
              : "VEHICLE_UPDATED",
          sourceType: "VEHICLE",
          sourceId: id,
          title:
            fields.includes("customerId")
              ? "Proprietário do veículo alterado"
              : fields.length === 1 && fields[0] === "currentMileage"
              ? "Quilometragem atualizada"
              : "Dados do veículo atualizados",
          mileage: input.currentMileage,
          eventDate: now,
          metadata: { fields },
          isManual: false,
        },
      });
      await tx.auditLog.create({
        data: auditData(
          actor,
          fields.includes("customerId")
            ? "OWNERSHIP_CHANGE"
            : "VEHICLE_UPDATE",
          id,
          { fields },
        ),
      });
      return vehicle;
    });
  } catch (error) {
    handleConflict(error);
  }
}
export async function deleteVehicle(actor: VehicleActor, id: string) {
  await prisma.$transaction(async (tx) => {
    const changed = await tx.vehicle.updateMany({
      where: { id, companyId: actor.companyId, deletedAt: null },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });
    if (!changed.count)
      throw new AppError(404, "VEHICLE_NOT_FOUND", "Veículo não encontrado.");
    await tx.auditLog.create({ data: auditData(actor, "VEHICLE_DELETE", id) });
  });
}
