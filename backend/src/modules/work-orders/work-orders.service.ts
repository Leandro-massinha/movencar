import type { Prisma } from "@prisma/client";
import { Prisma as PrismaRuntime } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type {
  CloseWorkOrderInput,
  ChecklistResultInput,
  CreateCheckInInput,
  CreateConcernInput,
  CreateDamageInput,
  CreatePdcInput,
  CreateWorkOrderInput,
  ListWorkOrdersInput,
  PdcFindingInput,
} from "./work-orders.schemas.js";

export type WorkOrderActor = {
  companyId: string;
  branchId: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
};

const workOrderSelect = {
  id: true,
  number: true,
  purpose: true,
  status: true,
  openedAt: true,
  closedAt: true,
  mileageAtEntry: true,
  notes: true,
  closingReason: true,
  closingNotes: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, code: true, name: true } },
  customer: { select: { id: true, name: true } },
  vehicle: { select: { id: true, plate: true, brand: true, model: true } },
  attendant: { select: { id: true, name: true } },
} satisfies Prisma.WorkOrderSelect;
const concernSelect = {
  id: true,
  description: true,
  category: true,
  priority: true,
  symptomStartedAt: true,
  frequency: true,
  condition: true,
  notes: true,
  sequence: true,
  reportedAt: true,
  reportedBy: { select: { name: true } },
} satisfies Prisma.CustomerConcernSelect;
const checkInSelect = {
  id: true,
  status: true,
  startedAt: true,
  completedAt: true,
  confirmedAt: true,
  mileage: true,
  fuelLevel: true,
  deliveredBy: true,
  generalNotes: true,
  templateVersion: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { name: true } },
} satisfies Prisma.VehicleCheckInSelect;

const audit = (
  actor: WorkOrderActor,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue,
) => ({
  companyId: actor.companyId,
  branchId: actor.branchId,
  actorUserId: actor.userId,
  action,
  entityType,
  entityId,
  metadata,
  ipAddress: actor.ipAddress,
  userAgent: actor.userAgent,
});

async function assertBranch(companyId: string, branchId: string) {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, companyId, status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  if (!branch)
    throw new AppError(404, "BRANCH_NOT_FOUND", "Filial não encontrada.");
}
async function assertCustomerAndVehicle(
  companyId: string,
  customerId: string,
  vehicleId: string,
) {
  const [customer, vehicle] = await prisma.$transaction([
    prisma.customer.findFirst({
      where: { id: customerId, companyId, status: "ACTIVE", deletedAt: null },
      select: { id: true },
    }),
    prisma.vehicle.findFirst({
      where: { id: vehicleId, companyId, status: "ACTIVE", deletedAt: null },
      select: { id: true },
    }),
  ]);
  if (!customer)
    throw new AppError(404, "CUSTOMER_NOT_FOUND", "Cliente não encontrado.");
  if (!vehicle)
    throw new AppError(404, "VEHICLE_NOT_FOUND", "Veículo não encontrado.");
}
function conflict(error: unknown): never {
  if (
    error instanceof PrismaRuntime.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    throw new AppError(
      409,
      "INTAKE_ALREADY_EXISTS",
      "Esta operação de entrada já foi registrada.",
    );
  throw error;
}

function assertSameIntake(
  existing: {
    branch: { id: string };
    customer: { id: string };
    vehicle: { id: string };
    purpose: string;
    mileageAtEntry: number | null;
    notes: string | null;
  },
  branchId: string,
  input: CreateWorkOrderInput,
) {
  if (
    existing.branch.id !== branchId ||
    existing.customer.id !== input.customerId ||
    existing.vehicle.id !== input.vehicleId ||
    existing.purpose !== input.purpose ||
    existing.mileageAtEntry !== (input.mileageAtEntry ?? null) ||
    existing.notes !== (input.notes ?? null)
  )
    throw new AppError(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "A chave de idempotência já foi usada em outra operação.",
    );
}

export async function listWorkOrders(
  companyId: string,
  input: ListWorkOrdersInput,
) {
  const where = {
    companyId,
    status: input.status,
    vehicleId: input.vehicleId,
    customerId: input.customerId,
  };
  const [data, total] = await prisma.$transaction([
    prisma.workOrder.findMany({
      where,
      select: workOrderSelect,
      orderBy: [{ openedAt: "desc" }, { number: "desc" }],
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.workOrder.count({ where }),
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
export async function getWorkOrder(companyId: string, id: string) {
  const order = await prisma.workOrder.findFirst({
    where: { id, companyId },
    select: workOrderSelect,
  });
  if (!order)
    throw new AppError(
      404,
      "WORK_ORDER_NOT_FOUND",
      "Ordem de Serviço não encontrada.",
    );
  return order;
}
export async function createWorkOrder(
  actor: WorkOrderActor,
  input: CreateWorkOrderInput,
  operationKey?: string,
) {
  const branchId = input.branchId ?? actor.branchId;
  await assertBranch(actor.companyId, branchId);
  await assertCustomerAndVehicle(
    actor.companyId,
    input.customerId,
    input.vehicleId,
  );
  if (operationKey) {
    const existing = await prisma.workOrder.findFirst({
      where: { companyId: actor.companyId, operationKey },
      select: workOrderSelect,
    });
    if (existing) {
      assertSameIntake(existing, branchId, input);
      return existing;
    }
  }
  try {
    return await prisma.$transaction(
      async (tx) => {
        const sequence = await tx.workOrderSequence.upsert({
          where: { companyId: actor.companyId },
          create: { companyId: actor.companyId, lastValue: 1 },
          update: { lastValue: { increment: 1 } },
          select: { lastValue: true },
        });
        const order = await tx.workOrder.create({
          data: {
            companyId: actor.companyId,
            branchId,
            customerId: input.customerId,
            vehicleId: input.vehicleId,
            attendantUserId: actor.userId,
            number: sequence.lastValue,
            purpose: input.purpose,
            mileageAtEntry: input.mileageAtEntry,
            notes: input.notes,
            operationKey,
          },
          select: workOrderSelect,
        });
        const event = await tx.vehicleHistoryEvent.create({
          data: {
            companyId: actor.companyId,
            vehicleId: input.vehicleId,
            branchId,
            actorUserId: actor.userId,
            eventType: "WORK_ORDER_OPENED",
            sourceType: "FUTURE_MODULE",
            sourceId: order.id,
            title: `Ordem de Serviço #${order.number} aberta`,
            mileage: input.mileageAtEntry,
            eventDate: order.openedAt,
            isManual: false,
          },
          select: { id: true },
        });
        if (input.mileageAtEntry != null) {
          await tx.vehicleOdometerReading.create({
            data: {
              companyId: actor.companyId,
              vehicleId: input.vehicleId,
              branchId,
              userId: actor.userId,
              mileage: input.mileageAtEntry,
              recordedAt: order.openedAt,
              source: "WORK_ORDER",
              sourceId: event.id,
            },
          });
          await tx.vehicle.updateMany({
            where: {
              id: input.vehicleId,
              companyId: actor.companyId,
              deletedAt: null,
              OR: [
                { currentMileage: null },
                { currentMileage: { lt: input.mileageAtEntry } },
              ],
            },
            data: { currentMileage: input.mileageAtEntry },
          });
        }
        await tx.auditLog.create({
          data: audit(
            { ...actor, branchId },
            "WORK_ORDER_CREATE",
            "WorkOrder",
            order.id,
            {
              number: order.number,
              purpose: order.purpose,
            },
          ),
        });
        return order;
      },
      { maxWait: 30_000, timeout: 15_000 },
    );
  } catch (error) {
    if (operationKey) {
      const existing = await prisma.workOrder.findFirst({
        where: { companyId: actor.companyId, operationKey },
        select: workOrderSelect,
      });
      if (existing) {
        assertSameIntake(existing, branchId, input);
        return existing;
      }
    }
    conflict(error);
  }
}
export async function closeWorkOrder(
  actor: WorkOrderActor,
  id: string,
  input: CloseWorkOrderInput,
) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const current = await tx.workOrder.findFirst({
      where: { id, companyId: actor.companyId },
      select: { status: true },
    });
    if (!current)
      throw new AppError(
        404,
        "WORK_ORDER_NOT_FOUND",
        "Ordem de Serviço não encontrada.",
      );
    if (current.status !== "OPEN")
      throw new AppError(
        409,
        "WORK_ORDER_NOT_OPEN",
        "A Ordem de Serviço não está aberta.",
      );
    const changed = await tx.workOrder.updateMany({
      where: { id, companyId: actor.companyId, status: "OPEN" },
      data: {
        status:
          input.outcome === "NO_SERVICE"
            ? "CLOSED_NO_SERVICE"
            : input.outcome === "COMPLETED"
              ? "CLOSED"
              : "CANCELLED",
        closedAt: now,
        closingReason:
          input.outcome === "NO_SERVICE" ? input.closingReason : null,
        closingNotes: input.closingNotes,
      },
    });
    if (!changed.count)
      throw new AppError(
        409,
        "WORK_ORDER_NOT_OPEN",
        "A Ordem de Serviço não está aberta.",
      );
    const order = await tx.workOrder.findFirstOrThrow({
      where: { id, companyId: actor.companyId },
      select: workOrderSelect,
    });
    await tx.vehicleHistoryEvent.create({
      data: {
        companyId: actor.companyId,
        vehicleId: order.vehicle.id,
        branchId: order.branch.id,
        actorUserId: actor.userId,
        eventType:
          input.outcome === "NO_SERVICE"
            ? "WORK_ORDER_CLOSED_NO_SERVICE"
            : input.outcome === "COMPLETED"
              ? "WORK_ORDER_COMPLETED"
              : "WORK_ORDER_CANCELLED",
        sourceType: "FUTURE_MODULE",
        sourceId: id,
        title:
          input.outcome === "NO_SERVICE"
            ? `Ordem de Serviço #${order.number} encerrada sem serviço`
            : input.outcome === "COMPLETED"
              ? `Ordem de Serviço #${order.number} encerrada`
              : `Ordem de Serviço #${order.number} cancelada`,
        eventDate: now,
        isManual: false,
      },
    });
    await tx.auditLog.create({
      data: audit(
        { ...actor, branchId: order.branch.id },
        "WORK_ORDER_CLOSE",
        "WorkOrder",
        id,
        {
          outcome: input.outcome,
          closingReason:
            input.outcome === "NO_SERVICE" ? input.closingReason : undefined,
        },
      ),
    });
    return order;
  });
}

export async function listConcerns(companyId: string, workOrderId: string) {
  await getWorkOrder(companyId, workOrderId);
  return prisma.customerConcern.findMany({
    where: { companyId, workOrderId },
    select: concernSelect,
    orderBy: [{ sequence: "asc" }, { id: "asc" }],
  });
}
export async function createConcern(
  actor: WorkOrderActor,
  workOrderId: string,
  input: CreateConcernInput,
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.workOrder.findFirst({
      where: { id: workOrderId, companyId: actor.companyId },
      select: { status: true },
    });
    if (!current)
      throw new AppError(
        404,
        "WORK_ORDER_NOT_FOUND",
        "Ordem de Serviço não encontrada.",
      );
    if (current.status !== "OPEN")
      throw new AppError(
        409,
        "WORK_ORDER_NOT_OPEN",
        "A Ordem de Serviço não está aberta.",
      );
    let order;
    try {
      order = await tx.workOrder.update({
        where: {
          id_companyId: { id: workOrderId, companyId: actor.companyId },
          status: "OPEN",
        },
        data: { concernCounter: { increment: 1 } },
        select: { concernCounter: true, vehicleId: true, branchId: true },
      });
    } catch (error) {
      if (
        error instanceof PrismaRuntime.PrismaClientKnownRequestError &&
        error.code === "P2025"
      )
        throw new AppError(
          409,
          "WORK_ORDER_NOT_OPEN",
          "A Ordem de Serviço não está aberta.",
        );
      throw error;
    }
    const concern = await tx.customerConcern.create({
      data: {
        ...input,
        companyId: actor.companyId,
        workOrderId,
        reportedByUserId: actor.userId,
        sequence: order.concernCounter,
      },
      select: concernSelect,
    });
    await tx.vehicleHistoryEvent.create({
      data: {
        companyId: actor.companyId,
        vehicleId: order.vehicleId,
        branchId: order.branchId,
        actorUserId: actor.userId,
        eventType: "CUSTOMER_CONCERN_RECORDED",
        sourceType: "FUTURE_MODULE",
        sourceId: concern.id,
        title: "Relato do cliente registrado",
        eventDate: concern.reportedAt,
        isManual: false,
      },
    });
    await tx.auditLog.create({
      data: audit(
        { ...actor, branchId: order.branchId },
        "CUSTOMER_CONCERN_CREATE",
        "CustomerConcern",
        concern.id,
        { workOrderId, sequence: concern.sequence },
      ),
    });
    return concern;
  });
}

export async function getCheckIn(companyId: string, workOrderId: string) {
  await getWorkOrder(companyId, workOrderId);
  const checkIn = await prisma.vehicleCheckIn.findFirst({
    where: { companyId, workOrderId },
    select: checkInSelect,
  });
  if (!checkIn)
    throw new AppError(404, "CHECK_IN_NOT_FOUND", "Check-in não encontrado.");
  return checkIn;
}
export async function createCheckIn(
  actor: WorkOrderActor,
  workOrderId: string,
  input: CreateCheckInInput,
) {
  const order = await prisma.workOrder.findFirst({
    where: { id: workOrderId, companyId: actor.companyId },
    select: {
      id: true,
      companyId: true,
      branchId: true,
      customerId: true,
      vehicleId: true,
      status: true,
    },
  });
  if (!order)
    throw new AppError(
      404,
      "WORK_ORDER_NOT_FOUND",
      "Ordem de Serviço não encontrada.",
    );
  if (order.status !== "OPEN")
    throw new AppError(
      409,
      "WORK_ORDER_NOT_OPEN",
      "A Ordem de Serviço não está aberta.",
    );
  try {
    return await prisma.$transaction(async (tx) => {
      const template =
        (await tx.checklistTemplate.findFirst({
          where: {
            companyId: actor.companyId,
            type: "CHECK_IN",
            isActive: true,
            isDefault: true,
          },
          orderBy: { version: "desc" },
          select: { id: true, version: true },
        })) ??
        (await tx.checklistTemplate.findFirst({
          where: {
            companyId: null,
            isSystem: true,
            type: "CHECK_IN",
            isActive: true,
            isDefault: true,
          },
          orderBy: { version: "desc" },
          select: { id: true, version: true },
        }));
      if (!template)
        throw new AppError(
          409,
          "CHECKLIST_TEMPLATE_NOT_FOUND",
          "Nenhum modelo de Lista de Verificação está disponível.",
        );
      const checkIn = await tx.vehicleCheckIn.create({
        data: {
          ...input,
          companyId: order.companyId,
          branchId: order.branchId,
          workOrderId: order.id,
          customerId: order.customerId,
          vehicleId: order.vehicleId,
          createdByUserId: actor.userId,
        },
        select: checkInSelect,
      });
      await tx.checklistInstance.create({
        data: {
          companyId: actor.companyId,
          workOrderId,
          checkInId: checkIn.id,
          templateId: template.id,
          templateVersion: template.version,
          createdByUserId: actor.userId,
        },
      });
      await tx.auditLog.create({
        data: audit(
          { ...actor, branchId: order.branchId },
          "CHECK_IN_CREATE",
          "VehicleCheckIn",
          checkIn.id,
          {
            workOrderId,
          },
        ),
      });
      return checkIn;
    });
  } catch (error) {
    conflict(error);
  }
}
export async function updateCheckIn(
  actor: WorkOrderActor,
  workOrderId: string,
  input: CreateCheckInInput,
) {
  await getWorkOrder(actor.companyId, workOrderId);
  const changed = await prisma.vehicleCheckIn.updateMany({
    where: { companyId: actor.companyId, workOrderId, status: "DRAFT" },
    data: input,
  });
  if (!changed.count)
    throw new AppError(
      409,
      "CHECK_IN_NOT_EDITABLE",
      "Somente um Check-in em rascunho pode ser alterado.",
    );
  return getCheckIn(actor.companyId, workOrderId);
}
export async function completeCheckIn(
  actor: WorkOrderActor,
  workOrderId: string,
) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const order = await tx.workOrder.findFirst({
      where: { id: workOrderId, companyId: actor.companyId },
      select: { id: true },
    });
    if (!order)
      throw new AppError(
        404,
        "WORK_ORDER_NOT_FOUND",
        "Ordem de Serviço não encontrada.",
      );
    const checkIn = await tx.vehicleCheckIn.findFirst({
      where: { companyId: actor.companyId, workOrderId, status: "DRAFT" },
      select: {
        id: true,
        vehicleId: true,
        branchId: true,
        mileage: true,
      },
    });
    if (!checkIn)
      throw new AppError(
        409,
        "CHECK_IN_NOT_EDITABLE",
        "O Check-in não está disponível para conclusão.",
      );
    const instance = await tx.checklistInstance.findFirst({
      where: {
        companyId: actor.companyId,
        workOrderId,
        checkInId: checkIn.id,
        status: "DRAFT",
      },
      select: { id: true, templateId: true },
    });
    if (!instance)
      throw new AppError(
        409,
        "CHECKLIST_NOT_EDITABLE",
        "A Lista de Verificação não está disponível para conclusão.",
      );
    const missingRequired = await tx.checklistTemplateItem.count({
      where: {
        section: { templateId: instance.templateId },
        active: true,
        isRequired: true,
        results: {
          none: { companyId: actor.companyId, instanceId: instance.id },
        },
      },
    });
    if (missingRequired)
      throw new AppError(
        409,
        "CHECKLIST_REQUIRED_ITEMS_MISSING",
        `Existem ${missingRequired} itens obrigatórios sem resposta.`,
      );
    const changed = await tx.vehicleCheckIn.updateMany({
      where: { id: checkIn.id, companyId: actor.companyId, status: "DRAFT" },
      data: { status: "COMPLETED", completedAt: now },
    });
    if (!changed.count)
      throw new AppError(
        409,
        "CHECK_IN_ALREADY_COMPLETED",
        "O Check-in já foi concluído por outra operação.",
      );
    const checklistChanged = await tx.checklistInstance.updateMany({
      where: { id: instance.id, companyId: actor.companyId, status: "DRAFT" },
      data: { status: "COMPLETED", completedAt: now },
    });
    if (!checklistChanged.count)
      throw new AppError(
        409,
        "CHECK_IN_ALREADY_COMPLETED",
        "O Check-in já foi concluído por outra operação.",
      );
    const event = await tx.vehicleHistoryEvent.create({
      data: {
        companyId: actor.companyId,
        vehicleId: checkIn.vehicleId,
        branchId: checkIn.branchId,
        actorUserId: actor.userId,
        eventType: "CHECK_IN_COMPLETED",
        sourceType: "FUTURE_MODULE",
        sourceId: checkIn.id,
        title: "Check-in concluído",
        mileage: checkIn.mileage,
        eventDate: now,
        isManual: false,
      },
      select: { id: true },
    });
    if (checkIn.mileage != null) {
      await tx.vehicleOdometerReading.create({
        data: {
          companyId: actor.companyId,
          vehicleId: checkIn.vehicleId,
          branchId: checkIn.branchId,
          userId: actor.userId,
          mileage: checkIn.mileage,
          recordedAt: now,
          source: "CHECK_IN",
          sourceId: event.id,
        },
      });
      await tx.vehicle.updateMany({
        where: {
          id: checkIn.vehicleId,
          companyId: actor.companyId,
          deletedAt: null,
          OR: [
            { currentMileage: null },
            { currentMileage: { lt: checkIn.mileage } },
          ],
        },
        data: { currentMileage: checkIn.mileage },
      });
    }
    await tx.auditLog.create({
      data: audit(
        { ...actor, branchId: checkIn.branchId },
        "CHECK_IN_COMPLETE",
        "VehicleCheckIn",
        checkIn.id,
        {
          workOrderId,
        },
      ),
    });
    return tx.vehicleCheckIn.findFirstOrThrow({
      where: { id: checkIn.id, companyId: actor.companyId },
      select: checkInSelect,
    });
  });
}

export async function getCheckInWorkspace(
  companyId: string,
  workOrderId: string,
) {
  const order = await getWorkOrder(companyId, workOrderId);
  const checkIn = await prisma.vehicleCheckIn.findFirst({
    where: { companyId, workOrderId },
    select: {
      ...checkInSelect,
      checklistInstance: {
        select: {
          id: true,
          status: true,
          templateVersion: true,
          startedAt: true,
          completedAt: true,
          template: {
            select: {
              id: true,
              name: true,
              version: true,
              sections: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  title: true,
                  description: true,
                  order: true,
                  items: {
                    where: { active: true },
                    orderBy: { order: "asc" },
                    select: {
                      id: true,
                      title: true,
                      description: true,
                      responseType: true,
                      order: true,
                      isRequired: true,
                      requiresPhoto: true,
                      photoRequiredOnIssue: true,
                      allowNotes: true,
                      options: true,
                    },
                  },
                },
              },
            },
          },
          results: {
            select: {
              id: true,
              itemId: true,
              status: true,
              textValue: true,
              numericValue: true,
              selectedValue: true,
              note: true,
              completedAt: true,
            },
          },
        },
      },
      damages: {
        select: {
          id: true,
          location: true,
          damageType: true,
          severity: true,
          description: true,
          observedAt: true,
          observedBy: { select: { name: true } },
        },
        orderBy: [{ observedAt: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!checkIn)
    throw new AppError(404, "CHECK_IN_NOT_FOUND", "Check-in não encontrado.");
  return { workOrder: order, checkIn };
}

export async function saveChecklistResult(
  actor: WorkOrderActor,
  workOrderId: string,
  itemId: string,
  input: ChecklistResultInput,
) {
  return prisma.$transaction(async (tx) => {
    const instance = await tx.checklistInstance.findFirst({
      where: {
        companyId: actor.companyId,
        workOrderId,
        status: "DRAFT",
        checkIn: { status: "DRAFT" },
      },
      select: { id: true, templateId: true },
    });
    if (!instance)
      throw new AppError(
        409,
        "CHECKLIST_NOT_EDITABLE",
        "Somente uma Lista de Verificação em rascunho pode ser alterada.",
      );
    const item = await tx.checklistTemplateItem.findFirst({
      where: {
        id: itemId,
        active: true,
        section: { templateId: instance.templateId },
      },
      select: { responseType: true, allowNotes: true },
    });
    if (!item)
      throw new AppError(
        404,
        "CHECKLIST_ITEM_NOT_FOUND",
        "Item da Lista de Verificação não encontrado.",
      );
    const valid =
      (item.responseType === "STATUS" && input.status !== undefined) ||
      (item.responseType === "TEXT" && input.textValue != null) ||
      (item.responseType === "NUMBER" && input.numericValue !== undefined) ||
      (item.responseType === "SELECT" && input.selectedValue != null);
    if (!valid)
      throw new AppError(
        400,
        "CHECKLIST_RESPONSE_INVALID",
        "A resposta não corresponde ao tipo do item.",
      );
    if (!item.allowNotes && input.note)
      throw new AppError(
        400,
        "CHECKLIST_NOTE_NOT_ALLOWED",
        "Este item não permite observação.",
      );
    return tx.checklistItemResult.upsert({
      where: {
        companyId_instanceId_itemId: {
          companyId: actor.companyId,
          instanceId: instance.id,
          itemId,
        },
      },
      create: {
        ...input,
        companyId: actor.companyId,
        instanceId: instance.id,
        itemId,
        completedByUserId: actor.userId,
      },
      update: {
        ...input,
        completedByUserId: actor.userId,
        completedAt: new Date(),
      },
      select: {
        id: true,
        itemId: true,
        status: true,
        textValue: true,
        numericValue: true,
        selectedValue: true,
        note: true,
        completedAt: true,
      },
    });
  });
}

export async function createDamage(
  actor: WorkOrderActor,
  workOrderId: string,
  input: CreateDamageInput,
  operationKey?: string,
) {
  if (operationKey) {
    const existing = await prisma.checkInDamage.findFirst({
      where: { companyId: actor.companyId, workOrderId, operationKey },
      select: {
        id: true,
        location: true,
        damageType: true,
        severity: true,
        description: true,
        observedAt: true,
      },
    });
    if (existing) return existing;
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const checkIn = await tx.vehicleCheckIn.findFirst({
        where: { companyId: actor.companyId, workOrderId, status: "DRAFT" },
        select: { id: true, vehicleId: true, branchId: true },
      });
      if (!checkIn)
        throw new AppError(
          409,
          "CHECK_IN_NOT_EDITABLE",
          "Avarias só podem ser registradas durante o Check-in em rascunho.",
        );
      const damage = await tx.checkInDamage.create({
        data: {
          ...input,
          companyId: actor.companyId,
          workOrderId,
          checkInId: checkIn.id,
          vehicleId: checkIn.vehicleId,
          observedByUserId: actor.userId,
          operationKey,
        },
        select: {
          id: true,
          location: true,
          damageType: true,
          severity: true,
          description: true,
          observedAt: true,
        },
      });
      await tx.vehicleHistoryEvent.create({
        data: {
          companyId: actor.companyId,
          vehicleId: checkIn.vehicleId,
          branchId: checkIn.branchId,
          actorUserId: actor.userId,
          eventType: "DAMAGE_RECORDED",
          sourceType: "FUTURE_MODULE",
          sourceId: damage.id,
          title: "Avaria registrada no Check-in",
          eventDate: damage.observedAt,
          isManual: false,
        },
      });
      await tx.auditLog.create({
        data: audit(
          { ...actor, branchId: checkIn.branchId },
          "DAMAGE_CREATE",
          "CheckInDamage",
          damage.id,
          {
            workOrderId,
            location: damage.location,
            damageType: damage.damageType,
            severity: damage.severity,
          },
        ),
      });
      return damage;
    });
  } catch (error) {
    if (operationKey) {
      const existing = await prisma.checkInDamage.findFirst({
        where: { companyId: actor.companyId, workOrderId, operationKey },
        select: {
          id: true,
          location: true,
          damageType: true,
          severity: true,
          description: true,
          observedAt: true,
        },
      });
      if (existing) return existing;
    }
    return conflict(error);
  }
}

const findingSelect = {
  id: true,
  category: true,
  location: true,
  status: true,
  severity: true,
  description: true,
  recommendation: true,
  requiresImmediateAttention: true,
  sequence: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PdcFindingSelect;

const pdcSelect = {
  id: true,
  status: true,
  startedAt: true,
  completedAt: true,
  mileage: true,
  generalNotes: true,
  createdAt: true,
  updatedAt: true,
  technician: { select: { id: true, name: true } },
  findings: {
    select: findingSelect,
    orderBy: [{ sequence: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.PreliminaryVehicleDiagnosticSelect;

export async function getPdcWorkspace(companyId: string, workOrderId: string) {
  const workOrder = await getWorkOrder(companyId, workOrderId);
  const [concerns, checkIn, pdc] = await prisma.$transaction([
    prisma.customerConcern.findMany({
      where: { companyId, workOrderId },
      select: concernSelect,
      orderBy: [{ sequence: "asc" }],
    }),
    prisma.vehicleCheckIn.findFirst({
      where: { companyId, workOrderId },
      select: {
        ...checkInSelect,
        damages: {
          select: {
            id: true,
            location: true,
            damageType: true,
            severity: true,
            description: true,
          },
          orderBy: { observedAt: "asc" },
        },
      },
    }),
    prisma.preliminaryVehicleDiagnostic.findFirst({
      where: { companyId, workOrderId, status: { not: "CANCELLED" } },
      select: pdcSelect,
    }),
  ]);
  return { workOrder, concerns, checkIn, pdc };
}

export async function createPdc(
  actor: WorkOrderActor,
  workOrderId: string,
  input: CreatePdcInput,
  operationKey?: string,
) {
  const resolveExisting = async () => {
    const existing = await prisma.preliminaryVehicleDiagnostic.findFirst({
      where: {
        companyId: actor.companyId,
        workOrderId,
        status: { not: "CANCELLED" },
      },
      select: { operationKey: true, mileage: true, generalNotes: true },
    });
    if (!existing) return null;
    if (!operationKey || existing.operationKey !== operationKey)
      throw new AppError(
        409,
        "PDC_ALREADY_EXISTS",
        "Já existe um PDC ativo para esta Ordem de Serviço.",
      );
    if (
      existing.mileage !== (input.mileage ?? null) ||
      existing.generalNotes !== (input.generalNotes ?? null)
    )
      throw new AppError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "A chave de idempotência já foi usada em outra operação.",
      );
    return prisma.preliminaryVehicleDiagnostic.findFirstOrThrow({
      where: {
        companyId: actor.companyId,
        workOrderId,
        status: { not: "CANCELLED" },
      },
      select: pdcSelect,
    });
  };
  const existing = await resolveExisting();
  if (existing) return existing;
  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.workOrder.findFirst({
        where: { id: workOrderId, companyId: actor.companyId, status: "OPEN" },
        select: { branchId: true, vehicleId: true },
      });
      if (!order)
        throw new AppError(
          404,
          "WORK_ORDER_NOT_FOUND",
          "Ordem de Serviço aberta não encontrada.",
        );
      const checkIn = await tx.vehicleCheckIn.findFirst({
        where: { companyId: actor.companyId, workOrderId, status: "COMPLETED" },
        select: { id: true },
      });
      if (!checkIn)
        throw new AppError(
          409,
          "CHECK_IN_NOT_COMPLETED",
          "Conclua o Check-in antes de iniciar o PDC.",
        );
      const pdc = await tx.preliminaryVehicleDiagnostic.create({
        data: {
          ...input,
          companyId: actor.companyId,
          branchId: order.branchId,
          workOrderId,
          vehicleId: order.vehicleId,
          technicianUserId: actor.userId,
          operationKey,
        },
        select: pdcSelect,
      });
      await tx.vehicleHistoryEvent.create({
        data: {
          companyId: actor.companyId,
          vehicleId: order.vehicleId,
          branchId: order.branchId,
          actorUserId: actor.userId,
          eventType: "PDC_STARTED",
          sourceType: "FUTURE_MODULE",
          sourceId: pdc.id,
          title: "PDC iniciado",
          eventDate: pdc.startedAt,
          isManual: false,
        },
      });
      await tx.auditLog.create({
        data: audit(
          { ...actor, branchId: order.branchId },
          "PDC_CREATE",
          "PreliminaryVehicleDiagnostic",
          pdc.id,
          { workOrderId },
        ),
      });
      return pdc;
    });
  } catch (error) {
    if (
      error instanceof PrismaRuntime.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const retry = await resolveExisting();
      if (retry) return retry;
    }
    throw error;
  }
}

export async function updatePdc(
  actor: WorkOrderActor,
  workOrderId: string,
  input: CreatePdcInput,
) {
  const changed = await prisma.preliminaryVehicleDiagnostic.updateMany({
    where: { companyId: actor.companyId, workOrderId, status: "DRAFT" },
    data: input,
  });
  if (!changed.count)
    throw new AppError(
      409,
      "PDC_NOT_EDITABLE",
      "Somente um PDC em rascunho pode ser alterado.",
    );
  return (await getPdcWorkspace(actor.companyId, workOrderId)).pdc;
}

export async function createPdcFinding(
  actor: WorkOrderActor,
  workOrderId: string,
  input: PdcFindingInput,
) {
  return prisma.$transaction(async (tx) => {
    const pdc = await tx.preliminaryVehicleDiagnostic.findFirst({
      where: { companyId: actor.companyId, workOrderId, status: "DRAFT" },
      select: { id: true },
    });
    if (!pdc)
      throw new AppError(
        409,
        "PDC_NOT_EDITABLE",
        "Somente um PDC em rascunho pode receber achados.",
      );
    const updated = await tx.preliminaryVehicleDiagnostic.update({
      where: {
        id_companyId: { id: pdc.id, companyId: actor.companyId },
        status: "DRAFT",
      },
      data: { findingCounter: { increment: 1 } },
      select: { findingCounter: true, branchId: true },
    });
    const finding = await tx.pdcFinding.create({
      data: {
        ...input,
        companyId: actor.companyId,
        pdcId: pdc.id,
        sequence: updated.findingCounter,
        createdByUserId: actor.userId,
      },
      select: findingSelect,
    });
    await tx.auditLog.create({
      data: audit(
        { ...actor, branchId: updated.branchId },
        "PDC_FINDING_CREATE",
        "PdcFinding",
        finding.id,
        {
          workOrderId,
          category: finding.category,
          severity: finding.severity,
          immediate: finding.requiresImmediateAttention,
        },
      ),
    });
    return finding;
  });
}

export async function updatePdcFinding(
  actor: WorkOrderActor,
  workOrderId: string,
  findingId: string,
  input: PdcFindingInput,
) {
  const pdc = await prisma.preliminaryVehicleDiagnostic.findFirst({
    where: { companyId: actor.companyId, workOrderId, status: "DRAFT" },
    select: { id: true },
  });
  if (!pdc)
    throw new AppError(
      409,
      "PDC_NOT_EDITABLE",
      "Somente um PDC em rascunho pode ser alterado.",
    );
  const changed = await prisma.pdcFinding.updateMany({
    where: { id: findingId, companyId: actor.companyId, pdcId: pdc.id },
    data: input,
  });
  if (!changed.count)
    throw new AppError(
      404,
      "PDC_FINDING_NOT_FOUND",
      "Achado do PDC não encontrado.",
    );
  return prisma.pdcFinding.findFirstOrThrow({
    where: { id: findingId, companyId: actor.companyId, pdcId: pdc.id },
    select: findingSelect,
  });
}

export async function completePdc(actor: WorkOrderActor, workOrderId: string) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const pdc = await tx.preliminaryVehicleDiagnostic.findFirst({
      where: { companyId: actor.companyId, workOrderId, status: "DRAFT" },
      select: {
        id: true,
        vehicleId: true,
        branchId: true,
        mileage: true,
        findingCounter: true,
      },
    });
    if (!pdc)
      throw new AppError(
        409,
        "PDC_NOT_EDITABLE",
        "O PDC não está disponível para conclusão.",
      );
    const changed = await tx.preliminaryVehicleDiagnostic.updateMany({
      where: { id: pdc.id, companyId: actor.companyId, status: "DRAFT" },
      data: { status: "COMPLETED", completedAt: now },
    });
    if (!changed.count)
      throw new AppError(
        409,
        "PDC_ALREADY_COMPLETED",
        "O PDC já foi concluído por outra operação.",
      );
    const event = await tx.vehicleHistoryEvent.create({
      data: {
        companyId: actor.companyId,
        vehicleId: pdc.vehicleId,
        branchId: pdc.branchId,
        actorUserId: actor.userId,
        eventType: "PDC_COMPLETED",
        sourceType: "FUTURE_MODULE",
        sourceId: pdc.id,
        title: "PDC concluído",
        description: `${pdc.findingCounter} anormalidade(s) identificada(s)`,
        mileage: pdc.mileage,
        eventDate: now,
        isManual: false,
      },
      select: { id: true },
    });
    if (pdc.mileage != null) {
      await tx.vehicleOdometerReading.create({
        data: {
          companyId: actor.companyId,
          vehicleId: pdc.vehicleId,
          branchId: pdc.branchId,
          userId: actor.userId,
          mileage: pdc.mileage,
          recordedAt: now,
          source: "INSPECTION",
          sourceId: event.id,
        },
      });
      await tx.vehicle.updateMany({
        where: {
          id: pdc.vehicleId,
          companyId: actor.companyId,
          deletedAt: null,
          OR: [
            { currentMileage: null },
            { currentMileage: { lt: pdc.mileage } },
          ],
        },
        data: { currentMileage: pdc.mileage },
      });
    }
    await tx.auditLog.create({
      data: audit(
        { ...actor, branchId: pdc.branchId },
        "PDC_COMPLETE",
        "PreliminaryVehicleDiagnostic",
        pdc.id,
        { workOrderId, findings: pdc.findingCounter },
      ),
    });
    return tx.preliminaryVehicleDiagnostic.findFirstOrThrow({
      where: { id: pdc.id, companyId: actor.companyId },
      select: pdcSelect,
    });
  });
}
