import { describe,expect,it } from 'vitest'
import { vehicleHistoryApi } from '../services/vehicleHistory'

describe('vehicle history mock mode',()=>{
  it('creates, filters and paginates manual events without using the API',async()=>{
    const vehicleId='mock-vehicle-a'
    const created=await vehicleHistoryApi.create(vehicleId,{eventType:'NOTE',title:'  Nota mock  ',description:'Teste local'})
    expect(created).toMatchObject({eventType:'NOTE',title:'Nota mock',isManual:true})
    const listed=await vehicleHistoryApi.list(vehicleId,{page:1,limit:1,eventType:'NOTE',sortOrder:'desc'})
    expect(listed.data.map(event=>event.id)).toContain(created.id)
    expect(listed.pagination).toMatchObject({page:1,limit:1,total:1,totalPages:1})
  })

  it('keeps histories isolated by vehicle in the mock adapter',async()=>{
    await vehicleHistoryApi.create('mock-vehicle-private',{eventType:'GENERAL',title:'Evento privado'})
    const other=await vehicleHistoryApi.list('mock-vehicle-other',{page:1,limit:20,sortOrder:'desc'})
    expect(other.data).toEqual([])
  })
})
