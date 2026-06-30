export const QUEUE_NAMES = {
  email: "email",
  notification: "notification",
  search: "search"
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
