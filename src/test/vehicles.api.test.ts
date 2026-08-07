import { beforeEach,describe,expect,it,vi } from 'vitest'

const http=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),delete:vi.fn()}))
vi.mock('../services/api',()=>({api:http}))

describe('vehicles real API mode',()=>{
  beforeEach(()=>{vi.resetModules();vi.stubEnv('VITE_USE_MOCKS','false');vi.clearAllMocks()})
  it('uses the protected vehicles endpoint for listing',async()=>{http.get.mockResolvedValue({data:{data:[],pagination:{page:1,limit:20,total:0,totalPages:0}}});const{vehiclesApi}=await import('../services/vehicles');await vehiclesApi.list({page:1,limit:20,search:'ABC1234'});expect(http.get).toHaveBeenCalledWith('/vehicles',{params:{page:1,limit:20,search:'ABC1234'}})})
  it('does not add companyId or demonstrative branch IDs when creating',async()=>{http.post.mockResolvedValue({data:{vehicle:{id:'vehicle-a'}}});const{vehiclesApi}=await import('../services/vehicles');const input={customerId:'11111111-1111-4111-8111-111111111111',brand:'VW',model:'Gol'};await vehiclesApi.create(input);expect(http.post).toHaveBeenCalledWith('/vehicles',input);expect(http.post.mock.calls[0][1]).not.toHaveProperty('companyId');expect(http.post.mock.calls[0][1]).not.toHaveProperty('originBranchId')})
})
