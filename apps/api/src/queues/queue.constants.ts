export const QUEUE_NAMES = {
  email: "email",
  notification: "notification",
  search: "search",
  taskReminder: "task-reminder",
  platformUsageSnapshot: "platform-usage-snapshot"
} as const;

export const EMAIL_JOB_NAMES = {
  sendEmail: "send-email"
} as const;

export const NOTIFICATION_JOB_NAMES = {
  publishNotification: "publish-notification"
} as const;

export const SEARCH_JOB_NAMES = {
  indexEntity: "index-entity"
} as const;

export const TASK_REMINDER_JOB_NAMES = {
  scanDueSoon: "scan-due-soon",
  scanOverdue: "scan-overdue"
} as const;

export const PLATFORM_USAGE_SNAPSHOT_JOB_NAMES = {
  generateDaily: "generate-daily"
} as const;
