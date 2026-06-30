export const supportedLocales = ["ar", "en"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export const defaultLocale: SupportedLocale = "ar";

export const roleNames = {
  SUPER_ADMIN: "SUPER_ADMIN",
  COMPANY_ADMIN: "COMPANY_ADMIN",
  MANAGER: "MANAGER",
  EMPLOYEE: "EMPLOYEE"
} as const;

export const permissions = {
  companiesRead: "companies:read",
  companiesWrite: "companies:write",
  usersRead: "users:read",
  usersWrite: "users:write",
  rolesRead: "roles:read",
  rolesWrite: "roles:write",
  departmentsRead: "departments:read",
  departmentsWrite: "departments:write",
  auditRead: "audit:read",
  activitiesRead: "activities:read"
} as const;

export const tenantHeader = "x-company-id";
