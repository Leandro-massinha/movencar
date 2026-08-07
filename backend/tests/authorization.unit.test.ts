import { describe, expect, it, vi } from 'vitest'
import { requirePermission } from '../src/modules/auth/auth.middleware.js'

describe('permission middleware', () => {
  it('allows users with every required permission', () => { const next = vi.fn(); requirePermission('tenant.read')({ auth: { permissions: ['tenant.read'] } } as any, {} as any, next); expect(next).toHaveBeenCalledWith() })
  it('denies a missing permission with 403', () => { const next = vi.fn(); requirePermission('tenant.write')({ auth: { permissions: ['tenant.read'] } } as any, {} as any, next); expect(next.mock.calls[0][0]).toMatchObject({ status: 403, code: 'FORBIDDEN' }) })
  it('denies an unauthenticated request', () => { const next = vi.fn(); requirePermission('tenant.read')({} as any, {} as any, next); expect(next.mock.calls[0][0]).toMatchObject({ status: 403 }) })
  it('denies users without customers.view', () => { const next = vi.fn(); requirePermission('customers.view')({ auth: { permissions: ['dashboard.view'] } } as any, {} as any, next); expect(next.mock.calls[0][0]).toMatchObject({ status: 403, code: 'FORBIDDEN' }) })
  it('denies users without customers.create', () => { const next = vi.fn(); requirePermission('customers.create')({ auth: { permissions: ['customers.view'] } } as any, {} as any, next); expect(next.mock.calls[0][0]).toMatchObject({ status: 403, code: 'FORBIDDEN' }) })
  it('denies users without vehicles.view', () => { const next = vi.fn(); requirePermission('vehicles.view')({ auth: { permissions: ['dashboard.view'] } } as any, {} as any, next); expect(next.mock.calls[0][0]).toMatchObject({ status: 403, code: 'FORBIDDEN' }) })
  it('denies users without vehicles.create', () => { const next = vi.fn(); requirePermission('vehicles.create')({ auth: { permissions: ['vehicles.view'] } } as any, {} as any, next); expect(next.mock.calls[0][0]).toMatchObject({ status: 403, code: 'FORBIDDEN' }) })
  it('denies users without vehicle_history.view', () => { const next = vi.fn(); requirePermission('vehicle_history.view')({ auth: { permissions: ['vehicles.view'] } } as any, {} as any, next); expect(next.mock.calls[0][0]).toMatchObject({ status: 403, code: 'FORBIDDEN' }) })
  it('denies users without vehicle_history.create', () => { const next = vi.fn(); requirePermission('vehicle_history.create')({ auth: { permissions: ['vehicle_history.view'] } } as any, {} as any, next); expect(next.mock.calls[0][0]).toMatchObject({ status: 403, code: 'FORBIDDEN' }) })
})
