import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/prisma.js'
import { AppError } from '../../lib/errors.js'
import { hashToken, signAccess, signRefresh, verifyRefresh } from './auth.tokens.js'

const LOCK_MINUTES = 15
const MAX_FAILURES = 5

export async function login(companyCode: string, email: string, password: string, ipAddress?: string, userAgent?: string) {
  const company = await prisma.company.findFirst({ where: { code: companyCode, status: 'ACTIVE', deletedAt: null } })
  if (!company) throw new AppError(401, 'INVALID_CREDENTIALS', 'Empresa, e-mail ou senha invalidos.')
  const user = await prisma.user.findFirst({ where: { companyId: company.id, email, deletedAt: null }, include: { defaultBranch: true } })
  if (!user) throw new AppError(401, 'INVALID_CREDENTIALS', 'Empresa, e-mail ou senha invalidos.')
  if (user.status !== 'ACTIVE') throw new AppError(403, 'USER_INACTIVE', 'Usuario inativo.')
  if (user.lockedUntil && user.lockedUntil > new Date()) throw new AppError(429, 'ACCOUNT_LOCKED', 'Conta temporariamente bloqueada.')
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    const failedLoginAttempts = user.failedLoginAttempts + 1
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts, lockedUntil: failedLoginAttempts >= MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null } })
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Empresa, e-mail ou senha invalidos.')
  }
  return prisma.$transaction(async (tx) => {
    await tx.userSession.updateMany({ where: { companyId: company.id, userId: user.id, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'NEW_LOGIN' } })
    const expiresAt = new Date(Date.now() + Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30) * 86_400_000)
    const provisional = await tx.userSession.create({ data: { companyId: company.id, userId: user.id, tokenHash: hashToken(crypto.randomUUID()), ipAddress, userAgent, expiresAt } })
    const refreshToken = signRefresh({ sub: user.id, companyId: company.id, sessionId: provisional.id })
    await tx.userSession.update({ where: { id: provisional.id }, data: { tokenHash: hashToken(refreshToken) } })
    await tx.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } })
    await tx.auditLog.create({ data: { companyId: company.id, branchId: user.defaultBranchId, actorUserId: user.id, action: 'AUTH_LOGIN', entityType: 'UserSession', entityId: provisional.id, ipAddress, userAgent } })
    return { accessToken: signAccess({ sub: user.id, companyId: company.id, branchId: user.defaultBranchId, sessionId: provisional.id }), refreshToken, expiresAt }
  })
}

export async function refresh(rawToken: string) {
  let claims
  try { claims = verifyRefresh(rawToken) } catch { throw new AppError(401, 'REFRESH_INVALID', 'Refresh token invalido.') }
  const session = await prisma.userSession.findFirst({ where: { id: claims.sessionId, companyId: claims.companyId, userId: claims.sub }, include: { user: true } })
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.tokenHash !== hashToken(rawToken)) throw new AppError(401, 'SESSION_REVOKED', 'Sessao revogada ou expirada.')
  const refreshToken = signRefresh({ sub: claims.sub, companyId: claims.companyId, sessionId: claims.sessionId })
  await prisma.userSession.update({ where: { id: session.id }, data: { tokenHash: hashToken(refreshToken), lastUsedAt: new Date() } })
  return { accessToken: signAccess({ sub: claims.sub, companyId: claims.companyId, branchId: session.user.defaultBranchId, sessionId: session.id }), refreshToken, expiresAt: session.expiresAt }
}

export async function currentUser(userId: string, companyId: string) {
  const user = await prisma.user.findFirstOrThrow({ where: { id: userId, companyId, deletedAt: null }, include: { company: true, defaultBranch: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } })
  return { user: { id: user.id, name: user.name, email: user.email, role: user.roles[0]?.role.name ?? 'Usuario', roles: user.roles.map(({ role }) => role.code), permissions: [...new Set(user.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code)))] }, tenant: { companyId: user.companyId, companyName: user.company.tradeName, branchId: user.defaultBranchId, branchName: user.defaultBranch.name } }
}
