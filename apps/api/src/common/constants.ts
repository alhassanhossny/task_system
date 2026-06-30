export const TENANT_HEADER = "x-company-id";

export const PERMISSIONS = {
  companiesRead: "companies:read",
  companiesWrite: "companies:write",
  usersRead: "users:read",
  usersWrite: "users:write",
  rolesRead: "roles:read",
  rolesWrite: "roles:write",
  departmentsRead: "departments:read",
  departmentsWrite: "departments:write",
  auditRead: "audit_logs:read",
  activitiesRead: "activities:read"
} as const;
