export const PLATFORM_EVENTS = {
  companySuspended: "PLATFORM_COMPANY_SUSPENDED",
  companyActivated: "PLATFORM_COMPANY_ACTIVATED",
  subscriptionCreated: "PLATFORM_SUBSCRIPTION_CREATED",
  subscriptionUpdated: "PLATFORM_SUBSCRIPTION_UPDATED",
  settingUpdated: "PLATFORM_SETTING_UPDATED",
  switchCreated: "PLATFORM_SWITCH_CREATED",
  switchEnded: "PLATFORM_SWITCH_ENDED"
} as const;

export type PlatformEventName = (typeof PLATFORM_EVENTS)[keyof typeof PLATFORM_EVENTS];
