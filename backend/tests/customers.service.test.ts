import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  customer: { findFirst: vi.fn(), updateMany: vi.fn(), findFirstOrThrow: vi.fn() },
  customerAddress: { findFirst: vi.fn(), updateMany: vi.fn(), findFirstOrThrow: vi.fn() },
  auditLog: { create: vi.fn() }, branch: { findFirst: vi.fn() }, $transaction: vi.fn(),
}))
vi.mock('../src/lib/prisma.js', () => ({ prisma: db }))

import { updateAddress, updateCustomer, type Actor } from '../src/modules/customers/customers.service.js'

const actor:Actor={companyId:'company-a',branchId:'branch-a',userId:'user-a'}
const customer={id:'customer-a',type:'INDIVIDUAL',document:'12345678901'}

describe('customer service tenant enforcement',()=>{
  beforeEach(()=>{vi.clearAllMocks();db.$transaction.mockImplementation(async(callback:(tx:typeof db)=>unknown)=>callback(db))})

  it('updates an address only with companyId and customerId in the write query',async()=>{
    db.customer.findFirst.mockResolvedValue(customer)
    db.customerAddress.findFirst.mockResolvedValue({id:'address-a'})
    db.customerAddress.updateMany.mockResolvedValue({count:1})
    db.customerAddress.findFirstOrThrow.mockResolvedValue({id:'address-a',customerId:'customer-a',city:'Sao Paulo'})
    await updateAddress(actor,'customer-a','address-a',{city:'Sao Paulo'})
    expect(db.customerAddress.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{id:'address-a',companyId:'company-a',customerId:'customer-a',deletedAt:null}}))
  })

  it('returns 404 before touching an address when the customer belongs to another tenant',async()=>{
    db.customer.findFirst.mockResolvedValue(null)
    await expect(updateAddress(actor,'customer-b','address-b',{city:'Leak'})).rejects.toMatchObject({status:404,code:'CUSTOMER_NOT_FOUND'})
    expect(db.customerAddress.updateMany).not.toHaveBeenCalled()
  })

  it('rejects changing customer type when the persisted document becomes incompatible',async()=>{
    db.customer.findFirst.mockResolvedValue(customer)
    await expect(updateCustomer(actor,'customer-a',{type:'COMPANY'})).rejects.toMatchObject({status:400,code:'INVALID_CUSTOMER_DOCUMENT'})
    expect(db.customer.updateMany).not.toHaveBeenCalled()
  })
})
