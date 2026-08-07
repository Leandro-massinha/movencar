import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

export async function audit(
  req: Request,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  if (!req.auth) return;
  await prisma.auditLog.create({
    data: {
      companyId: req.auth.companyId,
      branchId: req.auth.branchId,
      actorUserId: req.auth.userId,
      action,
      entityType,
      entityId,
      metadata: metadata as Prisma.InputJsonValue | undefined,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    },
  });
}
