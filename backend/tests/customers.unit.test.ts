import { describe, expect, it } from 'vitest'
import { createAddressSchema, createCustomerSchema, listCustomersSchema, updateCustomerSchema } from '../src/modules/customers/customers.schemas.js'

type Customer = { id: string; companyId: string; branchId?: string; name: string; document?: string; deletedAt?: Date; status: string }
type Address = { id: string; companyId: string; customerId: string; isPrimary: boolean; deletedAt?: Date }
class CustomerStore {
  customers: Customer[] = []
  addresses: Address[] = []
  branches = [{ id: 'a-main', companyId: 'A', active: true }, { id: 'b-main', companyId: 'B', active: true }]
  create(companyId: string, input: Omit<Customer, 'companyId' | 'deletedAt'>) {
    if (input.branchId && !this.branches.some((branch) => branch.id === input.branchId && branch.companyId === companyId && branch.active)) return undefined
    if (input.document && this.customers.some((row) => row.companyId === companyId && row.document === input.document && !row.deletedAt)) throw new Error('duplicate')
    const row = { ...input, companyId }; this.customers.push(row); return row
  }
  list(companyId: string, search = '', page = 1, limit = 20) { const found = this.customers.filter((row) => row.companyId === companyId && !row.deletedAt && (`${row.name} ${row.document}`).toLowerCase().includes(search.toLowerCase())); return { data: found.slice((page - 1) * limit, page * limit), total: found.length } }
  find(companyId: string, id: string) { return this.customers.find((row) => row.companyId === companyId && row.id === id && !row.deletedAt) }
  update(companyId: string, id: string, name: string) { const row = this.find(companyId, id); if (!row) return undefined; row.name = name; return row }
  remove(companyId: string, id: string) { const row = this.find(companyId, id); if (!row) return false; row.deletedAt = new Date(); row.status = 'INACTIVE'; this.addresses.filter((item) => item.companyId === companyId && item.customerId === id).forEach((item) => { item.deletedAt = new Date(); item.isPrimary = false }); return true }
  addAddress(companyId: string, customerId: string, address: Omit<Address, 'companyId' | 'customerId'>) { if (!this.find(companyId, customerId)) return undefined; if (address.isPrimary) this.addresses.filter((item) => item.companyId === companyId && item.customerId === customerId && !item.deletedAt).forEach((item) => { item.isPrimary = false }); const row = { ...address, companyId, customerId }; this.addresses.push(row); return row }
  findAddress(companyId: string, customerId: string, id: string) { return this.addresses.find((row) => row.id === id && row.companyId === companyId && row.customerId === customerId && !row.deletedAt) }
}
const seed = () => { const store = new CustomerStore(); store.create('A', { id: 'a1', name: 'Ana Cliente', document: '52998224725', branchId: 'a-main', status: 'ACTIVE' }); return store }

describe('customer validation', () => {
  it('normalizes and validates formatted CPF and whitespace', () => expect(createCustomerSchema.parse({ name: '  Ana   Maria ', document: '529.982.247-25' })).toMatchObject({ name: 'Ana Maria', document: '52998224725' }))
  it('normalizes and validates CNPJ for company customers', () => expect(createCustomerSchema.parse({ name: 'Empresa', type: 'COMPANY', document: '11.222.333/0001-81' }).document).toBe('11222333000181'))
  it('rejects invalid CPF and CNPJ check digits', () => { expect(() => createCustomerSchema.parse({ name: 'Pessoa', document: '123.456.789-01' })).toThrow(); expect(() => createCustomerSchema.parse({ name: 'Empresa', type: 'COMPANY', document: '12.345.678/0001-90' })).toThrow() })
  it('rejects CPF and CNPJ with all digits equal', () => { expect(() => createCustomerSchema.parse({ name: 'Pessoa', document: '11111111111' })).toThrow(); expect(() => createCustomerSchema.parse({ name: 'Empresa', type: 'COMPANY', document: '00000000000000' })).toThrow() })
  it('rejects CPF/CNPJ incompatible with the customer type', () => { expect(() => createCustomerSchema.parse({ name: 'PF', type: 'INDIVIDUAL', document: '11222333000181' })).toThrow(); expect(() => createCustomerSchema.parse({ name: 'PJ', type: 'COMPANY', document: '52998224725' })).toThrow() })
  it('rejects document length inconsistent with type', () => expect(() => createCustomerSchema.parse({ name: 'Empresa', type: 'COMPANY', document: '123' })).toThrow())
  it('rejects oversized and empty names', () => { expect(() => createCustomerSchema.parse({ name: '' })).toThrow(); expect(() => createCustomerSchema.parse({ name: 'x'.repeat(181) })).toThrow() })
  it('requires a field for updates', () => expect(() => updateCustomerSchema.parse({})).toThrow())
  it('caps pagination at 100 and applies defaults', () => { expect(listCustomersSchema.parse({})).toMatchObject({ page: 1, limit: 20 }); expect(() => listCustomersSchema.parse({ limit: 101 })).toThrow() })
  it('validates and normalizes addresses', () => expect(createAddressSchema.parse({ street: ' Rua   Um ', city: ' Sao Paulo ', state: 'sp', postalCode: '01.234-567', country: 'br' })).toMatchObject({ street: 'Rua Um', city: 'Sao Paulo', postalCode: '01234567', country: 'BR' }))
})

describe('customer tenant rules', () => {
  it('company A creates and lists its customer', () => { const store = seed(); expect(store.list('A').data.map((row) => row.id)).toEqual(['a1']) })
  it('company B does not list company A customers', () => expect(seed().list('B').data).toHaveLength(0))
  it('company B cannot read, update or delete company A customer', () => { const store = seed(); expect(store.find('B', 'a1')).toBeUndefined(); expect(store.update('B', 'a1', 'Leak')).toBeUndefined(); expect(store.remove('B', 'a1')).toBe(false) })
  it('rejects duplicate active documents in one company', () => expect(() => seed().create('A', { id: 'a2', name: 'Duplicate', document: '52998224725', status: 'ACTIVE' })).toThrow('duplicate'))
  it('permits the same document in different companies', () => expect(seed().create('B', { id: 'b1', name: 'Other', document: '52998224725', status: 'ACTIVE' })?.companyId).toBe('B'))
  it('rejects a branch from another company', () => expect(seed().create('A', { id: 'a2', name: 'Bad branch', branchId: 'b-main', status: 'ACTIVE' })).toBeUndefined())
  it('soft delete hides a customer and permits document reuse', () => { const store = seed(); expect(store.remove('A', 'a1')).toBe(true); expect(store.find('A', 'a1')).toBeUndefined(); expect(store.list('A').data).toHaveLength(0); expect(store.create('A', { id: 'a2', name: 'Recreated', document: '52998224725', status: 'ACTIVE' })).toBeDefined() })
  it('paginates and searches by name', () => { const store = seed(); store.create('A', { id: 'a2', name: 'Bruno Cliente', status: 'ACTIVE' }); expect(store.list('A', 'cliente', 1, 1)).toMatchObject({ total: 2, data: [{ id: 'a1' }] }); expect(store.list('A', 'bruno').data[0].id).toBe('a2') })
  it('searches by normalized document', () => expect(seed().list('A', '52998224725').data[0].id).toBe('a1'))
  it('isolates addresses by both company and customer', () => { const store = seed(); store.addAddress('A', 'a1', { id: 'addr1', isPrimary: true }); expect(store.findAddress('B', 'a1', 'addr1')).toBeUndefined(); expect(store.findAddress('A', 'other', 'addr1')).toBeUndefined() })
  it('keeps only one active primary address', () => { const store = seed(); store.addAddress('A', 'a1', { id: 'addr1', isPrimary: true }); store.addAddress('A', 'a1', { id: 'addr2', isPrimary: true }); expect(store.addresses.filter((row) => row.isPrimary && !row.deletedAt).map((row) => row.id)).toEqual(['addr2']) })
  it('soft deletes customer addresses together with the customer', () => { const store = seed(); store.addAddress('A', 'a1', { id: 'addr1', isPrimary: true }); store.remove('A', 'a1'); expect(store.findAddress('A', 'a1', 'addr1')).toBeUndefined() })
})
