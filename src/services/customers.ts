import { api } from './api'

export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
export type CustomerType = 'INDIVIDUAL' | 'COMPANY'
export interface Customer { id:string; originBranchId:string|null; type:CustomerType; status:CustomerStatus; name:string; tradeName:string|null; document:string|null; email:string|null; phone:string|null; whatsapp:string|null; createdAt:string; originBranch:{id:string;code:string;name:string}|null }
export interface CustomerList { data:Customer[]; pagination:{page:number;limit:number;total:number;totalPages:number} }
export interface CustomerInput { name:string; type:CustomerType; document?:string; email?:string; phone?:string; whatsapp?:string; originBranchId?:string }
const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false'
let mockCustomers:Customer[]=[{id:'demo-customer-1',originBranchId:null,type:'INDIVIDUAL',status:'ACTIVE',name:'Juliana Alves',tradeName:null,document:'12345678901',email:'juliana@exemplo.com',phone:'11999990000',whatsapp:'11999990000',createdAt:new Date().toISOString(),originBranch:null}]
export const customersApi = {
  list: async (params:{page:number;limit:number;search?:string;status?:CustomerStatus;type?:CustomerType}) => {
    if (!useMocks) return api.get<CustomerList>('/customers', { params }).then(({data}) => data)
    const search=(params.search||'').toLowerCase().replace(/\D/g,'')||params.search?.toLowerCase()||''
    const filtered=mockCustomers.filter(customer=>(!params.status||customer.status===params.status)&&(!params.type||customer.type===params.type)&&(!search||`${customer.name} ${customer.document||''} ${customer.email||''}`.toLowerCase().includes(search)))
    return {data:filtered.slice((params.page-1)*params.limit,params.page*params.limit),pagination:{page:params.page,limit:params.limit,total:filtered.length,totalPages:Math.ceil(filtered.length/params.limit)}}
  },
  create: async (input:CustomerInput) => {
    if (!useMocks) return api.post<{customer:Customer}>('/customers', input).then(({data}) => data.customer)
    const customer:Customer={id:crypto.randomUUID(),originBranchId:null,type:input.type,status:'ACTIVE',name:input.name.trim(),tradeName:null,document:input.document?.replace(/\D/g,'')||null,email:input.email||null,phone:input.phone?.replace(/\D/g,'')||null,whatsapp:input.whatsapp?.replace(/\D/g,'')||null,createdAt:new Date().toISOString(),originBranch:null}; mockCustomers=[customer,...mockCustomers]; return customer
  },
  remove: async (id:string) => { if (!useMocks) { await api.delete(`/customers/${id}`); return } mockCustomers=mockCustomers.filter(customer=>customer.id!==id) },
}
