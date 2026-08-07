import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { verifyAccess } from "./auth.tokens.js";

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const raw = req.get("authorization");
    if (!raw?.startsWith("Bearer "))
      throw new AppError(401, "AUTH_REQUIRED", "Autenticacao obrigatoria.");
    const claims = verifyAccess(raw.slice(7));
    if (claims.kind !== "access") throw new Error("invalid token kind");
    const session = await prisma.userSession.findFirst({
      where: {
        id: claims.sessionId,
        userId: claims.sub,
        companyId: claims.companyId,
      },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: {
                  include: { permissions: { include: { permission: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date())
      throw new AppError(
        401,
        "SESSION_REVOKED",
        "Sessão revogada ou expirada.",
      );
    if (session.user.status !== "ACTIVE" || session.user.deletedAt)
      throw new AppError(403, "USER_INACTIVE", "Usuario inativo.");
    const roles = session.user.roles.map(({ role }) => role.code);
    const permissions = [
      ...new Set(
        session.user.roles.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.code),
        ),
      ),
    ];
    req.auth = {
      userId: claims.sub,
      companyId: claims.companyId,
      branchId: claims.branchId,
      sessionId: claims.sessionId,
      roles,
      permissions,
    };
    void prisma.userSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });
    next();
  } catch (error) {
    next(
      error instanceof AppError
        ? error
        : new AppError(401, "TOKEN_INVALID", "Token inválido ou expirado."),
    );
  }
}

export const requirePermission =
  (...required: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (
      !req.auth ||
      !required.every((permission) =>
        req.auth!.permissions.includes(permission),
      )
    )
      return next(new AppError(403, "FORBIDDEN", "Permissão insuficiente."));
    next();
  };

export async function requireBranchAccess(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const branchId = String(
      req.params.branchId ??
        req.body?.branchId ??
        req.query.branchId ??
        req.auth?.branchId ??
        "",
    );
    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId: req.auth!.companyId,
        deletedAt: null,
        status: "ACTIVE",
      },
    });
    if (!branch)
      throw new AppError(
        403,
        "BRANCH_FORBIDDEN",
        "Filial não pertence à sessão atual.",
      );
    next();
  } catch (error) {
    next(error);
  }
}
