import { api } from './api'

export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
export type CustomerType = 'INDIVIDUAL' | 'COMPANY'
export interface Customer { id:string; originBranchId:string|null; type:CustomerType; status:CustomerStatus; name:string; tradeName:string|null; document:string|null; email:string|null; phone:string|null; whatsapp:string|null; createdAt:string; originBranch:{id:string;code:string;name:string}|null }
export interface CustomerList { data:Customer[]; pagination:{page:number;limit:number;total:number;totalPages:number} }
export interface CustomerInput { name:string; type:CustomerType; document?:string; email?:string; phone?:string; whatsapp?:string; originBranchId?:string }
export const customersApi = {
  list: (params:{page:number;limit:number;search?:string;status?:CustomerStatus;type?:CustomerType}) => api.get<CustomerList>('/customers', { params }).then(({data}) => data),
  create: (input:CustomerInput) => api.post<{customer:Customer}>('/customers', input).then(({data}) => data.customer),
  remove: (id:string) => api.delete(`/customers/${id}`),
}
