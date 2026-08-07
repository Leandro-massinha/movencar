import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const permissions = ['dashboard.view','agenda.view','vehicles.view','orders.view','finance.view','crm.view','yard.view','tools.view','settings.manage','tenant.read','tenant.write','customers.view','customers.create','customers.update','customers.delete']
const companies = [
  { code: 'oficina-avenida', legalName: 'Oficina Avenida Ltda', tradeName: 'Oficina Avenida', document: '11111111000191', users: [{ name: 'Marina Costa', email: 'marina@movencar.demo', role: 'ADMIN' }, { name: 'Carlos Gestor', email: 'carlos@movencar.demo', role: 'MANAGER' }] },
  { code: 'auto-center-norte', legalName: 'Auto Center Norte Ltda', tradeName: 'Auto Center Norte', document: '22222222000191', users: [{ name: 'Ana Souza', email: 'ana@autonorte.demo', role: 'ADMIN' }, { name: 'Paulo Tecnico', email: 'paulo@autonorte.demo', role: 'TECHNICIAN' }] }
]

async function main() {
  for (const code of permissions) await prisma.permission.upsert({ where: { code }, update: {}, create: { code, description: code } })
  const passwordHash = await bcrypt.hash('MovenCar@2026', 12)
  for (const companyInput of companies) {
    const company = await prisma.company.upsert({ where: { code: companyInput.code }, update: { tradeName: companyInput.tradeName }, create: { code: companyInput.code, legalName: companyInput.legalName, tradeName: companyInput.tradeName, document: companyInput.document } })
    const matrix = await prisma.branch.upsert({ where: { companyId_code: { companyId: company.id, code: 'MATRIZ' } }, update: {}, create: { companyId: company.id, code: 'MATRIZ', name: 'Matriz - Centro' } })
    await prisma.branch.upsert({ where: { companyId_code: { companyId: company.id, code: 'NORTE' } }, update: {}, create: { companyId: company.id, code: 'NORTE', name: 'Unidade Norte' } })
    for (const roleInput of [{ code: 'ADMIN', name: 'Administrador' }, { code: 'MANAGER', name: 'Gestor' }, { code: 'TECHNICIAN', name: 'Tecnico' }]) {
      const role = await prisma.role.upsert({ where: { companyId_code: { companyId: company.id, code: roleInput.code } }, update: {}, create: { companyId: company.id, ...roleInput } })
      const allowed = roleInput.code === 'ADMIN' ? permissions : roleInput.code === 'MANAGER' ? permissions.filter((p) => p !== 'settings.manage') : ['dashboard.view','agenda.view','vehicles.view','orders.view']
      const records = await prisma.permission.findMany({ where: { code: { in: allowed } } })
      await prisma.rolePermission.createMany({ data: records.map((permission) => ({ roleId: role.id, permissionId: permission.id })), skipDuplicates: true })
    }
    for (const input of companyInput.users) {
      let user = await prisma.user.findFirst({ where: { companyId: company.id, email: input.email } })
      if (!user) user = await prisma.user.create({ data: { companyId: company.id, defaultBranchId: matrix.id, name: input.name, email: input.email, passwordHash } })
      const role = await prisma.role.findFirstOrThrow({ where: { companyId: company.id, code: input.role } })
      await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: {}, create: { userId: user.id, roleId: role.id } })
    }
  }
}
main().finally(() => prisma.$disconnect())
