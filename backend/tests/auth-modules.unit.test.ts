import { describe,expect,it,vi } from 'vitest'

const db=vi.hoisted(()=>({user:{findFirstOrThrow:vi.fn()},companyModule:{findMany:vi.fn()}}))
vi.mock('../src/lib/prisma.js',()=>({prisma:db}))
import { currentUser } from '../src/modules/auth/auth.service.js'

describe('/auth/me module entitlements',()=>{
  it('returns only modules queried for the authenticated company',async()=>{
    db.user.findFirstOrThrow.mockResolvedValue({id:'user-a',companyId:'company-a',name:'Ana',email:'ana@example.com',defaultBranchId:'branch-a',company:{tradeName:'Empresa A'},defaultBranch:{name:'Matriz'},roles:[{role:{code:'ADMIN',name:'Administrador',permissions:[]}}]})
    db.companyModule.findMany.mockResolvedValue([{module:{code:'core'}},{module:{code:'customers'}},{module:{code:'vehicles'}}])
    const result=await currentUser('user-a','company-a')
    expect(result.tenant.enabledModules).toEqual(['core','customers','vehicles'])
    expect(db.user.findFirstOrThrow).toHaveBeenCalledWith(expect.objectContaining({where:{id:'user-a',companyId:'company-a',deletedAt:null}}))
    expect(db.companyModule.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({companyId:'company-a',status:'ACTIVE'})}))
  })

  it('does not advertise vehicles when the customers dependency is absent',async()=>{
    db.user.findFirstOrThrow.mockResolvedValue({id:'user-b',companyId:'company-b',name:'Bia',email:'bia@example.com',defaultBranchId:'branch-b',company:{tradeName:'Empresa B'},defaultBranch:{name:'Matriz'},roles:[]})
    db.companyModule.findMany.mockResolvedValue([{module:{code:'vehicles'}}])
    const result=await currentUser('user-b','company-b')
    expect(result.tenant.enabledModules).toEqual([])
  })
  it('does not advertise workshop without both customers and vehicles',async()=>{
    db.user.findFirstOrThrow.mockResolvedValue({id:'user-c',companyId:'company-c',name:'Caio',email:'caio@example.com',defaultBranchId:'branch-c',company:{tradeName:'Empresa C'},defaultBranch:{name:'Matriz'},roles:[]})
    db.companyModule.findMany.mockResolvedValue([{module:{code:'workshop'}},{module:{code:'customers'}}])
    const result=await currentUser('user-c','company-c')
    expect(result.tenant.enabledModules).toEqual(['customers'])
  })
})
