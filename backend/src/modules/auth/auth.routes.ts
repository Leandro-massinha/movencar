import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../../config/env.js";
import { asyncHandler, AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate } from "./auth.middleware.js";
import { loginSchema } from "./auth.schemas.js";
import { currentUser, login, refresh } from "./auth.service.js";

export const authRouter = Router();
const cookie = {
  httpOnly: true,
  secure: env.COOKIE_SECURE === "true",
  sameSite: "lax" as const,
  path: "/api/auth",
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
};
const limiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

authRouter.post(
  "/login",
  limiter,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const tokens = await login(
      input.companyCode,
      input.email,
      input.password,
      req.ip,
      req.get("user-agent"),
    );
    res
      .cookie("movencar_refresh", tokens.refreshToken, cookie)
      .json({ accessToken: tokens.accessToken, expiresAt: tokens.expiresAt });
  }),
);
authRouter.post(
  "/refresh",
  limiter,
  asyncHandler(async (req, res) => {
    const raw = req.cookies.movencar_refresh;
    if (!raw)
      throw new AppError(401, "REFRESH_REQUIRED", "Refresh token ausente.");
    const tokens = await refresh(raw);
    res
      .cookie("movencar_refresh", tokens.refreshToken, cookie)
      .json({ accessToken: tokens.accessToken, expiresAt: tokens.expiresAt });
  }),
);
authRouter.post(
  "/logout",
  authenticate,
  asyncHandler(async (req, res) => {
    await prisma.userSession.updateMany({
      where: {
        id: req.auth!.sessionId,
        companyId: req.auth!.companyId,
        userId: req.auth!.userId,
      },
      data: { revokedAt: new Date(), revokeReason: "LOGOUT" },
    });
    res
      .clearCookie("movencar_refresh", { ...cookie, maxAge: undefined })
      .status(204)
      .send();
  }),
);
authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) =>
    res.json(await currentUser(req.auth!.userId, req.auth!.companyId)),
  ),
);
authRouter.get(
  "/sessions",
  authenticate,
  asyncHandler(async (req, res) => {
    const sessions = await prisma.userSession.findMany({
      where: { companyId: req.auth!.companyId, userId: req.auth!.userId },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        revokeReason: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ sessions });
  }),
);
authRouter.delete(
  "/sessions/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const changed = await prisma.userSession.updateMany({
      where: {
        id: String(req.params.id),
        companyId: req.auth!.companyId,
        userId: req.auth!.userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date(), revokeReason: "USER_REVOKED" },
    });
    if (!changed.count)
      throw new AppError(404, "SESSION_NOT_FOUND", "Sessão não encontrada.");
    res.status(204).send();
  }),
);
