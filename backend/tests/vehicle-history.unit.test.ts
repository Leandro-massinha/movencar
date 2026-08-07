import { describe,expect,it } from 'vitest'
import { createHistoryEventSchema,listHistorySchema } from '../src/modules/vehicle-history/vehicle-history.schemas.js'

type Event={id:string;companyId:string;vehicleId:string;eventType:string;eventDate:Date;mileage?:number;isManual:boolean}
class HistoryStore{events:Event[]=[];vehicles=[{id:'va',companyId:'A',mileage:1000},{id:'vb',companyId:'B',mileage:500}]
create(companyId:string,vehicleId:string,event:Omit<Event,'companyId'|'vehicleId'>){const vehicle=this.vehicles.find(item=>item.id===vehicleId&&item.companyId===companyId);if(!vehicle)return undefined;const row={...event,companyId,vehicleId};this.events.push(row);if(event.mileage!=null&&event.mileage>vehicle.mileage)vehicle.mileage=event.mileage;return row}
list(companyId:string,vehicleId:string,type?:string){return this.events.filter(event=>event.companyId===companyId&&event.vehicleId===vehicleId&&(!type||event.eventType===type)).sort((a,b)=>b.eventDate.getTime()-a.eventDate.getTime())}
find(companyId:string,vehicleId:string,id:string){return this.events.find(event=>event.id===id&&event.companyId===companyId&&event.vehicleId===vehicleId)}}

describe('vehicle history validation',()=>{
it('validates manual title and type',()=>expect(createHistoryEventSchema.parse({title:'  Nota   importante ',eventType:'NOTE'})).toMatchObject({title:'Nota importante',eventType:'NOTE'}))
it('requires mileage for mileage events',()=>expect(()=>createHistoryEventSchema.parse({title:'Odometro',eventType:'MILEAGE_RECORDED'})).toThrow())
it('rejects negative or absurd mileage',()=>{expect(()=>createHistoryEventSchema.parse({title:'Km',mileage:-1})).toThrow();expect(()=>createHistoryEventSchema.parse({title:'Km',mileage:100_000_001})).toThrow()})
it('limits pagination and validates period',()=>{expect(listHistorySchema.parse({})).toMatchObject({page:1,limit:20,sortOrder:'desc'});expect(()=>listHistorySchema.parse({limit:101})).toThrow();expect(()=>listHistorySchema.parse({dateFrom:'2026-08-10',dateTo:'2026-08-01'})).toThrow()})
it('does not accept automatic event types from manual input',()=>expect(()=>createHistoryEventSchema.parse({title:'Fake',eventType:'VEHICLE_CREATED'})).toThrow())})

describe('vehicle history tenant and mileage rules',()=>{
it('company A creates and lists an event only for vehicle A',()=>{const store=new HistoryStore();expect(store.create('A','va',{id:'e1',eventType:'NOTE',eventDate:new Date(),isManual:true})).toBeDefined();expect(store.list('A','va')).toHaveLength(1)})
it('company B cannot view or create history for vehicle A',()=>{const store=new HistoryStore();store.create('A','va',{id:'e1',eventType:'NOTE',eventDate:new Date(),isManual:true});expect(store.list('B','va')).toHaveLength(0);expect(store.create('B','va',{id:'e2',eventType:'NOTE',eventDate:new Date(),isManual:true})).toBeUndefined()})
it('event lookup requires company and vehicle together',()=>{const store=new HistoryStore();store.create('A','va',{id:'e1',eventType:'NOTE',eventDate:new Date(),isManual:true});expect(store.find('B','va','e1')).toBeUndefined();expect(store.find('A','vb','e1')).toBeUndefined()})
it('orders latest events first and filters event type',()=>{const store=new HistoryStore();store.create('A','va',{id:'old',eventType:'NOTE',eventDate:new Date('2026-01-01'),isManual:true});store.create('A','va',{id:'new',eventType:'GENERAL',eventDate:new Date('2026-02-01'),isManual:true});expect(store.list('A','va').map(event=>event.id)).toEqual(['new','old']);expect(store.list('A','va','NOTE').map(event=>event.id)).toEqual(['old'])})
it('raises current mileage only when the event is greater',()=>{const store=new HistoryStore();store.create('A','va',{id:'e1',eventType:'MILEAGE_RECORDED',eventDate:new Date(),mileage:1500,isManual:true});expect(store.vehicles[0].mileage).toBe(1500);store.create('A','va',{id:'e2',eventType:'MILEAGE_RECORDED',eventDate:new Date(),mileage:1200,isManual:true});expect(store.vehicles[0].mileage).toBe(1500)})})
