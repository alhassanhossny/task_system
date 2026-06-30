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
  activitiesRead: "activities:read",
  attachmentsRead: "attachments:read",
  attachmentsWrite: "attachments:write",
  commentsRead: "comments:read",
  commentsWrite: "comments:write",
  notificationsRead: "notifications:read",
  notificationsWrite: "notifications:write",
  smtpSettingsRead: "smtp_settings:read",
  smtpSettingsWrite: "smtp_settings:write",
  searchRead: "search:read",
  workflowsRead: "approval_workflows:read",
  workflowsWrite: "approval_workflows:write",
  tagsRead: "tags:read",
  tagsWrite: "tags:write",
  userPreferencesRead: "user_preferences:read",
  userPreferencesWrite: "user_preferences:write"
} as const;
