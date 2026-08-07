import type { Permission, TenantContext } from "../types/auth";

const permissionModules: Partial<Record<Permission, string>> = {
  "agenda.view": "workshop",
  "orders.view": "workshop",
  "customers.view": "customers",
  "customers.create": "customers",
  "customers.update": "customers",
  "customers.delete": "customers",
  "vehicles.view": "vehicles",
  "vehicles.create": "vehicles",
  "vehicles.update": "vehicles",
  "vehicles.delete": "vehicles",
  "vehicle_history.view": "vehicles",
  "vehicle_history.create": "vehicles",
  "finance.view": "finance",
  "crm.view": "crm",
  "yard.view": "yard",
  "tools.view": "tools-assets",
};

export const moduleForPermission = (permission: Permission) =>
  permissionModules[permission] ?? "core";
export const hasModule = (tenant: TenantContext, moduleCode: string) =>
  tenant.enabledModules?.includes(moduleCode) ?? false;
