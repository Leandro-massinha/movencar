import crypto from 'node:crypto'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { env } from '../../config/env.js'

export type AccessClaims = { kind: 'access'; sub: string; companyId: string; branchId: string; sessionId: string }
export type RefreshClaims = { kind: 'refresh'; sub: string; companyId: string; sessionId: string; nonce: string }
export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')
export const signAccess = (claims: Omit<AccessClaims, 'kind'>) => jwt.sign({ ...claims, kind: 'access' }, env.ACCESS_TOKEN_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'] })
export const signRefresh = (claims: Omit<RefreshClaims, 'kind' | 'nonce'>) => jwt.sign({ ...claims, kind: 'refresh', nonce: crypto.randomUUID() }, env.REFRESH_TOKEN_SECRET, { expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` })
export const verifyAccess = (token: string) => jwt.verify(token, env.ACCESS_TOKEN_SECRET) as AccessClaims
export const verifyRefresh = (token: string) => jwt.verify(token, env.REFRESH_TOKEN_SECRET) as RefreshClaims
