import { describe, expect, it } from 'vitest'
import { passwordSchema } from '../src/modules/auth/auth.schemas.js'
import { hashToken, signAccess, signRefresh, verifyAccess, verifyRefresh } from '../src/modules/auth/auth.tokens.js'

describe('security primitives', () => {
  it('accepts a strong password', () => expect(passwordSchema.safeParse('MovenCar@2026').success).toBe(true))
  it.each(['short','alllowercase1!','ALLUPPERCASE1!','NoNumber!xx','NoSpecial123'])('rejects weak password %s', (password) => expect(passwordSchema.safeParse(password).success).toBe(false))
  it('hashes refresh tokens without storing plaintext', () => { const hash = hashToken('secret'); expect(hash).toHaveLength(64); expect(hash).not.toContain('secret') })
  it('creates access token with tenant claims', () => { const token = signAccess({ sub: 'u1', companyId: 'c1', branchId: 'b1', sessionId: 's1' }); expect(verifyAccess(token)).toMatchObject({ kind: 'access', sub: 'u1', companyId: 'c1', branchId: 'b1', sessionId: 's1' }) })
  it('creates refresh token with a nonce', () => { const token = signRefresh({ sub: 'u1', companyId: 'c1', sessionId: 's1' }); expect(verifyRefresh(token)).toMatchObject({ kind: 'refresh', sub: 'u1', companyId: 'c1', sessionId: 's1' }); expect(verifyRefresh(token).nonce).toBeTruthy() })
})
