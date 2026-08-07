import type { Prisma } from '@prisma/client'
import { Prisma as PrismaRuntime } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { AppError } from '../../lib/errors.js'
import type { CreateAddressInput, CreateCustomerInput, ListCustomersInput, UpdateAddressInput, UpdateCustomerInput } from './customers.schemas.js'

export type Actor = { companyId: string; branchId: string; userId: string; ipAddress?: string; userAgent?: string }
const customerSelect = { id: true, originBranchId: true, type: true, status: true, name: true, tradeName: true, document: true, stateRegistration: true, email: true, phone: true, whatsapp: true, birthDate: true, notes: true, createdAt: true, updatedAt: true, originBranch: { select: { id: true, code: true, name: true } } } satisfies Prisma.CustomerSelect
const addressSelect = { id: true, customerId: true, label: true, postalCode: true, street: true, number: true, complement: true, neighborhood: true, city: true, state: true, country: true, isPrimary: true, createdAt: true, updatedAt: true } satisfies Prisma.CustomerAddressSelect

const auditData = (actor: Actor, action: string, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) => ({ companyId: actor.companyId, branchId: actor.branchId, actorUserId: actor.userId, action, entityType, entityId, metadata, ipAddress: actor.ipAddress, userAgent: actor.userAgent })
async function assertBranch(companyId: string, branchId?: string | null) {
  if (!branchId) return
  const branch = await prisma.branch.findFirst({ where: { id: branchId, companyId, status: 'ACTIVE', deletedAt: null }, select: { id: true } })
  if (!branch) throw new AppError(404, 'BRANCH_NOT_FOUND', 'Filial nao encontrada.')
}
function handleConflict(error: unknown): never {
  if (error instanceof PrismaRuntime.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(409, 'CUSTOMER_DOCUMENT_EXISTS', 'Documento ja cadastrado nesta empresa.')
  throw error
}

export async function listCustomers(companyId: string, input: ListCustomersInput) {
  const normalizedSearch = input.search?.replace(/\D/g, '')
  const where: Prisma.CustomerWhereInput = { companyId, deletedAt: null, status: input.status, type: input.type, originBranchId: input.branchId,
    ...(input.search ? { OR: [
      { name: { contains: input.search, mode: 'insensitive' } }, { tradeName: { contains: input.search, mode: 'insensitive' } },
      { document: { contains: normalizedSearch || input.search } }, { phone: { contains: normalizedSearch || input.search } },
      { whatsapp: { contains: normalizedSearch || input.search } }, { email: { contains: input.search, mode: 'insensitive' } },
    ] } : {}) }
  const [data, total] = await prisma.$transaction([
    prisma.customer.findMany({ where, select: customerSelect, orderBy: { [input.sortBy]: input.sortOrder }, skip: (input.page - 1) * input.limit, take: input.limit }),
    prisma.customer.count({ where }),
  ])
  return { data, pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } }
}

export async function getCustomer(companyId: string, id: string) {
  const customer = await prisma.customer.findFirst({ where: { id, companyId, deletedAt: null }, select: customerSelect })
  if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Cliente nao encontrado.')
  return customer
}

export async function createCustomer(actor: Actor, input: CreateCustomerInput) {
  await assertBranch(actor.companyId, input.originBranchId)
  try { return await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({ data: { ...input, companyId: actor.companyId }, select: customerSelect })
    await tx.auditLog.create({ data: auditData(actor, 'CUSTOMER_CREATE', 'Customer', customer.id, { name: customer.name }) })
    return customer
  }) } catch (error) { handleConflict(error) }
}

export async function updateCustomer(actor: Actor, id: string, input: UpdateCustomerInput) {
  await getCustomer(actor.companyId, id); await assertBranch(actor.companyId, input.originBranchId)
  try { return await prisma.$transaction(async (tx) => {
    const result = await tx.customer.updateMany({ where: { id, companyId: actor.companyId, deletedAt: null }, data: input })
    if (!result.count) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Cliente nao encontrado.')
    const customer = await tx.customer.findFirstOrThrow({ where: { id, companyId: actor.companyId, deletedAt: null }, select: customerSelect })
    await tx.auditLog.create({ data: auditData(actor, 'CUSTOMER_UPDATE', 'Customer', id, { fields: Object.keys(input) }) })
    return customer
  }) } catch (error) { handleConflict(error) }
}

export async function deleteCustomer(actor: Actor, id: string) {
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    const result = await tx.customer.updateMany({ where: { id, companyId: actor.companyId, deletedAt: null }, data: { deletedAt: now, status: 'INACTIVE' } })
    if (!result.count) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Cliente nao encontrado.')
    await tx.customerAddress.updateMany({ where: { customerId: id, companyId: actor.companyId, deletedAt: null }, data: { deletedAt: now, isPrimary: false } })
    await tx.auditLog.create({ data: auditData(actor, 'CUSTOMER_DELETE', 'Customer', id) })
  })
}

export async function listAddresses(companyId: string, customerId: string) {
  await getCustomer(companyId, customerId)
  return prisma.customerAddress.findMany({ where: { companyId, customerId, deletedAt: null }, select: addressSelect, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] })
}

export async function createAddress(actor: Actor, customerId: string, input: CreateAddressInput) {
  await getCustomer(actor.companyId, customerId)
  return prisma.$transaction(async (tx) => {
    if (input.isPrimary) await tx.customerAddress.updateMany({ where: { companyId: actor.companyId, customerId, deletedAt: null, isPrimary: true }, data: { isPrimary: false } })
    const address = await tx.customerAddress.create({ data: { ...input, companyId: actor.companyId, customerId }, select: addressSelect })
    await tx.auditLog.create({ data: auditData(actor, 'CUSTOMER_ADDRESS_CREATE', 'CustomerAddress', address.id, { customerId }) })
    return address
  })
}

export async function updateAddress(actor: Actor, customerId: string, addressId: string, input: UpdateAddressInput) {
  await getCustomer(actor.companyId, customerId)
  return prisma.$transaction(async (tx) => {
    const current = await tx.customerAddress.findFirst({ where: { id: addressId, companyId: actor.companyId, customerId, deletedAt: null }, select: { id: true } })
    if (!current) throw new AppError(404, 'ADDRESS_NOT_FOUND', 'Endereco nao encontrado.')
    if (input.isPrimary) await tx.customerAddress.updateMany({ where: { companyId: actor.companyId, customerId, deletedAt: null, isPrimary: true, id: { not: addressId } }, data: { isPrimary: false } })
    const address = await tx.customerAddress.update({ where: { id: addressId }, data: input, select: addressSelect })
    await tx.auditLog.create({ data: auditData(actor, 'CUSTOMER_ADDRESS_UPDATE', 'CustomerAddress', addressId, { customerId, fields: Object.keys(input) }) })
    return address
  })
}

export async function deleteAddress(actor: Actor, customerId: string, addressId: string) {
  await getCustomer(actor.companyId, customerId)
  await prisma.$transaction(async (tx) => {
    const result = await tx.customerAddress.updateMany({ where: { id: addressId, companyId: actor.companyId, customerId, deletedAt: null }, data: { deletedAt: new Date(), isPrimary: false } })
    if (!result.count) throw new AppError(404, 'ADDRESS_NOT_FOUND', 'Endereco nao encontrado.')
    await tx.auditLog.create({ data: auditData(actor, 'CUSTOMER_ADDRESS_DELETE', 'CustomerAddress', addressId, { customerId }) })
  })
}
