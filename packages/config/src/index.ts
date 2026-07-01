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
  usersViewTeam: "users:view_team",
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
  savedFiltersRead: "saved_filters:read",
  savedFiltersWrite: "saved_filters:write",
  workflowsRead: "approval_workflows:read",
  workflowsWrite: "approval_workflows:write",
  tagsRead: "tags:read",
  tagsWrite: "tags:write",
  userPreferencesRead: "user_preferences:read",
  userPreferencesWrite: "user_preferences:write",
  tasksRead: "tasks:read",
  tasksCreate: "tasks:create",
  tasksUpdate: "tasks:update",
  tasksDelete: "tasks:delete",
  tasksAssign: "tasks:assign",
  tasksComment: "tasks:comment",
  tasksAttach: "tasks:attach",
  tasksComplete: "tasks:complete",
  tasksViewTeam: "tasks:view_team",
  tasksAssignTeam: "tasks:assign_team",
  leaveRequestsRead: "leave_requests:read",
  leaveRequestsSubmit: "leave_requests:submit",
  leaveRequestsUpdate: "leave_requests:update",
  leaveRequestsCancel: "leave_requests:cancel",
  leaveRequestsApprove: "leave_requests:approve",
  leaveRequestsReject: "leave_requests:reject",
  leaveRequestsViewTeam: "leave_requests:view_team",
  leaveRequestsApproveTeam: "leave_requests:approve_team",
  leaveRequestsRejectTeam: "leave_requests:reject_team",
  calendarViewTeam: "calendar:view_team",
  leaveTypesRead: "leave_types:read",
  leaveTypesWrite: "leave_types:write",
  leaveBalancesRead: "leave_balances:read",
  leaveBalancesWrite: "leave_balances:write",
  leaveSettingsRead: "leave_settings:read",
  leaveSettingsWrite: "leave_settings:write",
  emailsRead: "emails:read",
  emailsSend: "emails:send",
  emailTemplatesManage: "email_templates:manage"
} as const;

export const tenantHeader = "x-company-id";
