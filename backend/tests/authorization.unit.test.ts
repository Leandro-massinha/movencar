import { describe, expect, it, vi } from 'vitest'
import { requirePermission } from '../src/modules/auth/auth.middleware.js'

describe('permission middleware', () => {
  it('allows users with every required permission', () => { const next = vi.fn(); requirePermission('tenant.read')({ auth: { permissions: ['tenant.read'] } } as any, {} as any, next); expect(next).toHaveBeenCalledWith() })
  it('denies a missing permission with 403', () => { const next = vi.fn(); requirePermission('tenant.write')({ auth: { permissions: ['tenant.read'] } } as any, {} as any, next); expect(next.mock.calls[0][0]).toMatchObject({ status: 403, code: 'FORBIDDEN' }) })
  it('denies an unauthenticated request', () => { const next = vi.fn(); requirePermission('tenant.read')({} as any, {} as any, next); expect(next.mock.calls[0][0]).toMatchObject({ status: 403 }) })
})
