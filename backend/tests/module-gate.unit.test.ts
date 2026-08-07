import { beforeEach,describe,expect,it,vi } from 'vitest'

const db=vi.hoisted(()=>({companyModule:{findMany:vi.fn(),findFirst:vi.fn()}}))
vi.mock('../src/lib/prisma.js',()=>({prisma:db}))
import { listEnabledModules,requireModule } from '../src/modules/platform/module-gate.js'

describe('company module gate',()=>{
  beforeEach(()=>vi.clearAllMocks())
  it('lists only active, non-expired modules for the authenticated company',async()=>{db.companyModule.findMany.mockResolvedValue([{module:{code:'vehicles'}}]);await expect(listEnabledModules('company-a',new Date('2026-08-07T12:00:00Z'))).resolves.toEqual(['vehicles']);expect(db.companyModule.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({companyId:'company-a',status:'ACTIVE',module:{status:'ACTIVE'}})}))})
  it('allows a company with an active module',async()=>{db.companyModule.findFirst.mockResolvedValue({companyId:'company-a'});const next=vi.fn();await requireModule('vehicles')({auth:{companyId:'company-a'}} as any,{} as any,next);expect(next).toHaveBeenCalledWith();expect(db.companyModule.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({companyId:'company-a',status:'ACTIVE',module:{code:'vehicles',status:'ACTIVE'}})}))})
  it('blocks a company without the module even if a permission could exist',async()=>{db.companyModule.findFirst.mockResolvedValue(null);const next=vi.fn();await requireModule('fiscal')({auth:{companyId:'company-a',permissions:['invoices.create']}} as any,{} as any,next);expect(next.mock.calls[0][0]).toMatchObject({status:403,code:'MODULE_NOT_AVAILABLE'})})
  it('never queries another company while authorizing the current tenant',async()=>{db.companyModule.findFirst.mockResolvedValue(null);const next=vi.fn();await requireModule('vehicles')({auth:{companyId:'company-b'}} as any,{} as any,next);expect(db.companyModule.findFirst.mock.calls[0][0].where.companyId).toBe('company-b')})
})
