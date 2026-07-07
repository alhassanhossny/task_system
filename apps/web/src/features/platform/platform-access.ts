export const platformPermissions = {
  read: "platform:read",
  manage: "platform:manage",
  analyticsRead: "analytics:read",
  companiesSuspend: "companies:suspend",
  subscriptionsManage: "subscriptions:manage",
  tenantSwitchExecute: "tenant_switch:execute",
  settingsUpdate: "platform_settings:update"
} as const;

export type PermissionList = string[] | readonly string[] | undefined | null;

export function hasPermission(permissions: PermissionList, permission: string) {
  return Boolean(permissions?.includes(permission));
}

export function canViewPlatform(permissions: PermissionList) {
  return hasPermission(permissions, platformPermissions.read);
}

export function canManagePlatform(permissions: PermissionList) {
  return hasPermission(permissions, platformPermissions.manage);
}

export function canReadAnalytics(permissions: PermissionList) {
  return hasPermission(permissions, platformPermissions.analyticsRead);
}

export function canSuspendCompanies(permissions: PermissionList) {
  return canManagePlatform(permissions) && hasPermission(permissions, platformPermissions.companiesSuspend);
}

export function canManageSubscriptions(permissions: PermissionList) {
  return canManagePlatform(permissions) && hasPermission(permissions, platformPermissions.subscriptionsManage);
}

export function canSwitchTenants(permissions: PermissionList) {
  return canManagePlatform(permissions) && hasPermission(permissions, platformPermissions.tenantSwitchExecute);
}

export function canUpdatePlatformSettings(permissions: PermissionList) {
  return canManagePlatform(permissions) && hasPermission(permissions, platformPermissions.settingsUpdate);
}
