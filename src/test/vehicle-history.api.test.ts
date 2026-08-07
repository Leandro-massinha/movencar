import { beforeEach,describe,expect,it,vi } from 'vitest'

const http=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}))
vi.mock('../services/api',()=>({api:http}))

describe('vehicle history real API mode',()=>{
  beforeEach(()=>{vi.resetModules();vi.stubEnv('VITE_USE_MOCKS','false');vi.clearAllMocks()})

  it('lists the tenant-protected vehicle history with filters',async()=>{
    http.get.mockResolvedValue({data:{data:[],pagination:{page:1,limit:20,total:0,totalPages:0}}})
    const{vehicleHistoryApi}=await import('../services/vehicleHistory')
    const params={page:1,limit:20,eventType:'NOTE' as const,sortOrder:'desc' as const}
    await vehicleHistoryApi.list('vehicle-a',params)
    expect(http.get).toHaveBeenCalledWith('/vehicles/vehicle-a/history',{params})
  })

  it('sends only user-editable event fields when creating',async()=>{
    http.post.mockResolvedValue({data:{event:{id:'event-a'}}})
    const{vehicleHistoryApi}=await import('../services/vehicleHistory')
    const input={eventType:'NOTE' as const,title:'Retorno do cliente',description:'Ruido ao frear'}
    await vehicleHistoryApi.create('vehicle-a',input)
    expect(http.post).toHaveBeenCalledWith('/vehicles/vehicle-a/history',input)
    expect(http.post.mock.calls[0][1]).not.toHaveProperty('companyId')
    expect(http.post.mock.calls[0][1]).not.toHaveProperty('actorUserId')
    expect(http.post.mock.calls[0][1]).not.toHaveProperty('sourceType')
  })
})
