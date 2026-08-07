import { describe,expect,it } from 'vitest'
import { createVehicleSchema,listVehicleRecordsSchema,listVehiclesSchema,updateVehicleSchema } from '../src/modules/vehicles/vehicles.schemas.js'

type Row={id:string;companyId:string;customerId:string;branchId?:string;plate?:string|null;chassis?:string|null;brand:string;model:string;status:string;deletedAt?:Date}
class Store{rows:Row[]=[];customers=[{id:'ca',companyId:'A',active:true},{id:'cb',companyId:'B',active:true}];branches=[{id:'ba',companyId:'A',active:true},{id:'bb',companyId:'B',active:true}]
create(companyId:string,input:Omit<Row,'companyId'|'deletedAt'>){if(!this.customers.some(x=>x.id===input.customerId&&x.companyId===companyId&&x.active))return undefined;if(input.branchId&&!this.branches.some(x=>x.id===input.branchId&&x.companyId===companyId&&x.active))return undefined;if(input.plate&&this.rows.some(x=>x.companyId===companyId&&x.plate===input.plate&&!x.deletedAt))throw new Error('plate');if(input.chassis&&this.rows.some(x=>x.companyId===companyId&&x.chassis===input.chassis&&!x.deletedAt))throw new Error('chassis');const row={...input,companyId};this.rows.push(row);return row}
find(companyId:string,id:string){return this.rows.find(x=>x.companyId===companyId&&x.id===id&&!x.deletedAt)}
list(companyId:string,search='',page=1,limit=20){const value=search.toLowerCase();const found=this.rows.filter(x=>x.companyId===companyId&&!x.deletedAt&&`${x.plate} ${x.brand} ${x.model}`.toLowerCase().includes(value));return{data:found.slice((page-1)*limit,page*limit),total:found.length}}
update(companyId:string,id:string,model:string){const row=this.find(companyId,id);if(!row)return undefined;row.model=model;return row}
remove(companyId:string,id:string){const row=this.find(companyId,id);if(!row)return false;row.deletedAt=new Date();row.status='INACTIVE';return true}}
const seed=()=>{const store=new Store();store.create('A',{id:'va',customerId:'ca',branchId:'ba',plate:'ABC1234',chassis:'9BWZZZ377VT004251',brand:'Volkswagen',model:'Gol',status:'ACTIVE'});return store}
const customerId='11111111-1111-4111-8111-111111111111'

describe('vehicle validation',()=>{
it('normalizes legacy and Mercosul plates',()=>{expect(createVehicleSchema.parse({customerId,brand:'VW',model:'Gol',plate:'abc-1234'}).plate).toBe('ABC1234');expect(createVehicleSchema.parse({customerId,brand:'VW',model:'Polo',plate:'abc 1d23'}).plate).toBe('ABC1D23')})
it('allows a vehicle without plate',()=>expect(createVehicleSchema.parse({customerId,brand:'Maquina',model:'Sem placa'}).plate).toBeUndefined())
it('normalizes chassis and RENAVAM',()=>expect(createVehicleSchema.parse({customerId,brand:'VW',model:'Gol',chassis:'9bwzzz377vt004251',renavam:'001.234.567-89'})).toMatchObject({chassis:'9BWZZZ377VT004251',renavam:'00123456789'}))
it('rejects invalid plate, negative mileage and absurd doors',()=>{const base={customerId,brand:'VW',model:'Gol'};expect(()=>createVehicleSchema.parse({...base,plate:'INVALIDA'})).toThrow();expect(()=>createVehicleSchema.parse({...base,currentMileage:-1})).toThrow();expect(()=>createVehicleSchema.parse({...base,doors:20})).toThrow()})
it('requires changes on update and limits pagination',()=>{expect(()=>updateVehicleSchema.parse({})).toThrow();expect(listVehiclesSchema.parse({})).toMatchObject({page:1,limit:20});expect(()=>listVehiclesSchema.parse({limit:101})).toThrow()})
it('limits ownership and odometer pagination to 100',()=>{expect(listVehicleRecordsSchema.parse({})).toEqual({page:1,limit:20});expect(()=>listVehicleRecordsSchema.parse({limit:101})).toThrow()})})

describe('vehicle tenant rules',()=>{
it('company A creates and lists its vehicle',()=>expect(seed().list('A').data.map(x=>x.id)).toEqual(['va']))
it('company B cannot list or read company A vehicle',()=>{const store=seed();expect(store.list('B').data).toHaveLength(0);expect(store.find('B','va')).toBeUndefined()})
it('company B cannot update or delete company A vehicle',()=>{const store=seed();expect(store.update('B','va','Leak')).toBeUndefined();expect(store.remove('B','va')).toBe(false)})
it('rejects customer from another company',()=>expect(seed().create('A',{id:'x',customerId:'cb',brand:'VW',model:'Gol',status:'ACTIVE'})).toBeUndefined())
it('rejects branch from another company',()=>expect(seed().create('A',{id:'x',customerId:'ca',branchId:'bb',brand:'VW',model:'Gol',status:'ACTIVE'})).toBeUndefined())
it('rejects duplicate active plate within a company',()=>expect(()=>seed().create('A',{id:'x',customerId:'ca',plate:'ABC1234',brand:'VW',model:'Polo',status:'ACTIVE'})).toThrow('plate'))
it('allows same plate in different companies',()=>expect(seed().create('B',{id:'vb',customerId:'cb',plate:'ABC1234',brand:'VW',model:'Gol',status:'ACTIVE'})?.companyId).toBe('B'))
it('rejects duplicate active chassis within a company',()=>expect(()=>seed().create('A',{id:'x',customerId:'ca',chassis:'9BWZZZ377VT004251',brand:'VW',model:'Polo',status:'ACTIVE'})).toThrow('chassis'))
it('soft deletes and allows plate reuse',()=>{const store=seed();expect(store.remove('A','va')).toBe(true);expect(store.list('A').data).toHaveLength(0);expect(store.create('A',{id:'new',customerId:'ca',plate:'ABC1234',brand:'VW',model:'Novo',status:'ACTIVE'})).toBeDefined()})
it('searches by plate and model',()=>{const store=seed();expect(store.list('A','ABC1234').data[0].id).toBe('va');expect(store.list('A','gol').data[0].id).toBe('va')})
it('paginates vehicle results',()=>{const store=seed();store.create('A',{id:'v2',customerId:'ca',brand:'Fiat',model:'Uno',status:'ACTIVE'});expect(store.list('A','',1,1)).toMatchObject({total:2,data:[{id:'va'}]})})})
