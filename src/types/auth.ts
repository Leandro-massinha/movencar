export type Permission = 'dashboard.view' | 'agenda.view' | 'vehicles.view' | 'vehicles.create' | 'vehicles.update' | 'vehicles.delete' | 'orders.view' | 'finance.view' | 'crm.view' | 'yard.view' | 'tools.view' | 'settings.manage' | 'customers.view' | 'customers.create' | 'customers.update' | 'customers.delete'
export interface User { id: string; name: string; email: string; role: 'Administrador' | 'Gestor' | 'Tecnico'; permissions: Permission[] }
export interface TenantContext { companyId: string; companyName: string; branchId: string; branchName: string; enabledModules: string[] }
