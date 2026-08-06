import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler, AppError } from '../../lib/errors.js'
import { prisma } from '../../lib/prisma.js'
import { authenticate, requireBranchAccess, requirePermission } from '../auth/auth.middleware.js'
import { audit } from '../audit/audit.service.js'

export const tenantRouter = Router()
tenantRouter.use(authenticate)
tenantRouter.get('/test-resources', requirePermission('tenant.read'), asyncHandler(async (req, res) => {
  res.json({ resources: await prisma.tenantTestResource.findMany({ where: { companyId: req.auth!.companyId }, orderBy: { createdAt: 'desc' } }) })
}))
tenantRouter.post('/test-resources', requirePermission('tenant.write'), requireBranchAccess, asyncHandler(async (req, res) => {
  const input = z.object({ branchId: z.string().uuid(), name: z.string().trim().min(2).max(120) }).parse(req.body)
  const resource = await prisma.tenantTestResource.create({ data: { companyId: req.auth!.companyId, branchId: input.branchId, name: input.name } })
  await audit(req, 'TENANT_RESOURCE_CREATED', 'TenantTestResource', resource.id)
  res.status(201).json({ resource })
}))
tenantRouter.get('/test-resources/:id', requirePermission('tenant.read'), asyncHandler(async (req, res) => {
  const resource = await prisma.tenantTestResource.findFirst({ where: { id: String(req.params.id), companyId: req.auth!.companyId } })
  if (!resource) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Recurso nao encontrado.')
  res.json({ resource })
}))
