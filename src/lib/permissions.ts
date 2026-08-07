import type { Permission, User } from "../types/auth";
export const hasPermission = (user: User | null, permission: Permission) =>
  Boolean(user?.permissions.includes(permission));
