import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";

const moduleDependencies: Record<string, string[]> = {
  vehicles: ["customers"],
  workshop: ["customers", "vehicles"],
};
const requiredCodes = (code: string) => [
  code,
  ...(moduleDependencies[code] ?? []),
];

export async function listEnabledModules(companyId: string, at = new Date()) {
  const rows = await prisma.companyModule.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      activatedAt: { lte: at },
      OR: [{ expiresAt: null }, { expiresAt: { gt: at } }],
      module: { status: "ACTIVE" },
    },
    select: { module: { select: { code: true } } },
  });
  const enabled = new Set(rows.map(({ module }) => module.code));
  return [...enabled].filter((code) =>
    (moduleDependencies[code] ?? []).every((dependency) =>
      enabled.has(dependency),
    ),
  );
}

export const requireModule =
  (code: string) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.auth)
        throw new AppError(401, "AUTH_REQUIRED", "Autenticacao obrigatoria.");
      const now = new Date();
      const enabled = await prisma.companyModule.findMany({
        where: {
          companyId: req.auth.companyId,
          status: "ACTIVE",
          activatedAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          module: { code: { in: requiredCodes(code) }, status: "ACTIVE" },
        },
        select: { module: { select: { code: true } } },
      });
      const enabledCodes = new Set(enabled.map(({ module }) => module.code));
      if (!requiredCodes(code).every((required) => enabledCodes.has(required)))
        throw new AppError(
          403,
          "MODULE_NOT_AVAILABLE",
          "Módulo não contratado ou indisponível.",
        );
      next();
    } catch (error) {
      next(error);
    }
  };
