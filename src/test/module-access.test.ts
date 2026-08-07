import { describe,expect,it } from 'vitest'
import { hasModule,moduleForPermission } from '../lib/moduleAccess'

const tenant={companyId:'company-a',companyName:'Empresa A',branchId:'branch-a',branchName:'Matriz',enabledModules:['core','customers']}
describe('frontend module access',()=>{
  it('maps permissions to their commercial module',()=>{expect(moduleForPermission('customers.create')).toBe('customers');expect(moduleForPermission('vehicles.view')).toBe('vehicles');expect(moduleForPermission('settings.manage')).toBe('core')})
  it('hides unavailable modules using server-provided tenant context',()=>{expect(hasModule(tenant,'customers')).toBe(true);expect(hasModule(tenant,'vehicles')).toBe(false)})
})
