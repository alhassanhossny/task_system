export type Lang = "ar" | "en";

export type PageId =
  | "dashboard"
  | "tasks-kanban"
  | "tasks-list"
  | "leaves"
  | "team"
  | "email"
  | "employees"
  | "superadmin"
  | "platform-dashboard"
  | "platform-companies"
  | "platform-subscriptions"
  | "platform-plans"
  | "platform-analytics"
  | "platform-settings"
  | "platform-switch-sessions";

export type UiText = Record<string, string>;
