import { apiFetch } from "@/lib/api/client";

export type CompanyPlan = "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
export type CompanyStatus = "ACTIVE" | "TRIAL" | "SUSPENDED";
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
export type BillingInterval = "MONTHLY" | "YEARLY";
export type SwitchSessionStatus = "ACTIVE" | "ENDED" | "REVOKED" | "EXPIRED";
export type AnalyticsRange = "7d" | "30d" | "90d" | "365d";

export interface PlatformContext {
  token: string;
}

export interface PlatformListResponse<T, Q = unknown> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    query?: Q;
    placeholder?: boolean;
    message?: string;
  };
}

export interface CompanySummary {
  id: string;
  name: string;
  slug: string;
  plan: CompanyPlan;
  status: CompanyStatus;
  primaryDomain?: string | null;
  billingEmail?: string | null;
  supportEmail?: string | null;
  timezone: string;
  trialEndsAt?: string | null;
  suspendedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyListItem extends CompanySummary {
  usersCount: number;
}

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  tier: CompanyPlan;
  monthlyPrice: string | number;
  yearlyPrice: string | number;
  currency: string;
  maxUsers?: number | null;
  maxStorageMb?: number | null;
  maxCompanies?: number | null;
  features: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompanySubscription {
  id: string;
  companyId: string;
  planId: string;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  seats: number;
  startsAt: string;
  trialEndsAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelledAt?: string | null;
  metadata?: Record<string, unknown>;
  company: CompanySummary;
  plan: SubscriptionPlan;
  _count?: {
    invoices: number;
  };
}

export interface CompanyDetail {
  company: CompanySummary;
  subscription: CompanySubscription | null;
  usersCount: number;
  departmentsCount: number;
  tasksCount: number;
  storageUsage: number;
  lastActivityAt?: string | null;
}

export interface PlatformOverview {
  companies: {
    total: number;
    active: number;
    suspended: number;
    trialing: number;
  };
  subscriptions: {
    total: number;
    active: number;
    expired: number;
    cancelled: number;
  };
  users: {
    total: number;
  };
  usage: {
    totalTasks: number;
    totalLeaveRequests: number;
    totalEmails: number;
    totalAttachments: number;
  };
}

export interface UsageMetricPoint {
  date: string;
  value: number;
}

export interface PlatformUsageMetrics {
  range: AnalyticsRange;
  companies: UsageMetricPoint[];
  users: UsageMetricPoint[];
  tasks: UsageMetricPoint[];
  emails: UsageMetricPoint[];
}

export interface TopCompanyUsage {
  companyId: string;
  companyName: string;
  users: number;
  tasks: number;
  emails: number;
  storageBytes: number;
  plan: CompanyPlan;
}

export interface SwitchSession {
  id: string;
  companyId: string;
  actorCompanyId: string;
  actorUserId: string;
  status: SwitchSessionStatus;
  reason?: string | null;
  startedAt: string;
  expiresAt: string;
  endedAt?: string | null;
  revokedAt?: string | null;
  targetCompany: CompanySummary;
  actorCompany: CompanySummary;
  actorUser: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateSwitchSessionResponse {
  sessionId: string;
  companyId: string;
  token: string;
  expiresAt: string;
  status: SwitchSessionStatus;
  session: SwitchSession;
}

export interface PlatformSetting {
  id: string;
  key: string;
  isSecret: boolean;
}

export interface CompaniesFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: CompanyStatus | "";
  plan?: CompanyPlan | "";
}

export interface PlansFilters {
  page?: number;
  limit?: number;
  search?: string;
  tier?: CompanyPlan | "";
  isActive?: boolean | "";
}

export interface SubscriptionsFilters {
  page?: number;
  limit?: number;
  companyId?: string;
  planId?: string;
  status?: SubscriptionStatus | "";
  billingInterval?: BillingInterval | "";
}

export interface SwitchSessionsFilters {
  page?: number;
  limit?: number;
  companyId?: string;
  actorUserId?: string;
  status?: SwitchSessionStatus | "";
}

export interface AnalyticsFilters {
  range?: AnalyticsRange;
  companyId?: string;
  periodFrom?: string;
  periodTo?: string;
}

export interface CreatePlanPayload {
  code: string;
  name: string;
  tier?: CompanyPlan;
  monthlyPrice?: number;
  yearlyPrice?: number;
  currency?: string;
  maxUsers?: number;
  maxStorageMb?: number;
  maxCompanies?: number;
  features?: Record<string, unknown>;
  isActive?: boolean;
}

export interface CreateSubscriptionPayload {
  companyId: string;
  planId: string;
  status?: SubscriptionStatus;
  billingInterval?: BillingInterval;
  seats?: number;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateSubscriptionPayload {
  planId?: string;
  status?: SubscriptionStatus;
  billingInterval?: BillingInterval;
  seats?: number;
  currentPeriodEnd?: string;
  cancelledAt?: string;
  metadata?: Record<string, unknown>;
}

function queryString(filters: object = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export const platformService = {
  overview(context: PlatformContext) {
    return apiFetch<PlatformOverview>("/platform/analytics/overview", { token: context.token });
  },
  usage(context: PlatformContext, filters: AnalyticsFilters = {}) {
    return apiFetch<PlatformUsageMetrics>(`/platform/analytics/usage${queryString(filters)}`, { token: context.token });
  },
  topCompanies(context: PlatformContext, filters: AnalyticsFilters = {}) {
    return apiFetch<TopCompanyUsage[]>(`/platform/analytics/top-companies${queryString(filters)}`, { token: context.token });
  },
  subscriptionDistribution(context: PlatformContext) {
    return apiFetch<Record<CompanyPlan, number>>("/platform/analytics/subscription-distribution", { token: context.token });
  },
  companies(context: PlatformContext, filters: CompaniesFilters = {}) {
    return apiFetch<PlatformListResponse<CompanyListItem, CompaniesFilters>>(`/platform/companies${queryString(filters)}`, { token: context.token });
  },
  company(context: PlatformContext, id: string) {
    return apiFetch<CompanyDetail>(`/platform/companies/${id}`, { token: context.token });
  },
  suspendCompany(context: PlatformContext, id: string, reason?: string) {
    return apiFetch<CompanySummary>(`/platform/companies/${id}/suspend`, {
      method: "POST",
      token: context.token,
      body: JSON.stringify({ reason })
    });
  },
  activateCompany(context: PlatformContext, id: string, reason?: string) {
    return apiFetch<CompanySummary>(`/platform/companies/${id}/activate`, {
      method: "POST",
      token: context.token,
      body: JSON.stringify({ reason })
    });
  },
  plans(context: PlatformContext, filters: PlansFilters = {}) {
    return apiFetch<PlatformListResponse<SubscriptionPlan, PlansFilters>>(`/platform/plans${queryString(filters)}`, { token: context.token });
  },
  createPlan(context: PlatformContext, payload: CreatePlanPayload) {
    return apiFetch<SubscriptionPlan>("/platform/plans", {
      method: "POST",
      token: context.token,
      body: JSON.stringify(payload)
    });
  },
  subscriptions(context: PlatformContext, filters: SubscriptionsFilters = {}) {
    return apiFetch<PlatformListResponse<CompanySubscription, SubscriptionsFilters>>(`/platform/subscriptions${queryString(filters)}`, { token: context.token });
  },
  createSubscription(context: PlatformContext, payload: CreateSubscriptionPayload) {
    return apiFetch<CompanySubscription>("/platform/subscriptions", {
      method: "POST",
      token: context.token,
      body: JSON.stringify(payload)
    });
  },
  updateSubscription(context: PlatformContext, id: string, payload: UpdateSubscriptionPayload) {
    return apiFetch<CompanySubscription>(`/platform/subscriptions/${id}`, {
      method: "PATCH",
      token: context.token,
      body: JSON.stringify(payload)
    });
  },
  settings(context: PlatformContext) {
    return apiFetch<PlatformListResponse<PlatformSetting>>("/platform/settings", { token: context.token });
  },
  updateSetting(context: PlatformContext, id: string, payload: { value: unknown; valueType?: string; description?: string; isSecret?: boolean }) {
    return apiFetch<{ data: { id: string; accepted: boolean; requestedAt: string; input?: unknown } }>(`/platform/settings/${id}`, {
      method: "PATCH",
      token: context.token,
      body: JSON.stringify(payload)
    });
  },
  switchSessions(context: PlatformContext, filters: SwitchSessionsFilters = {}) {
    return apiFetch<PlatformListResponse<SwitchSession, SwitchSessionsFilters>>(`/platform/switch-sessions${queryString(filters)}`, { token: context.token });
  },
  createSwitchSession(context: PlatformContext, payload: { companyId: string; reason?: string; expiresAt?: string }) {
    return apiFetch<CreateSwitchSessionResponse>("/platform/switch-company", {
      method: "POST",
      token: context.token,
      body: JSON.stringify(payload)
    });
  },
  endSwitchSession(context: PlatformContext, sessionId: string) {
    return apiFetch<SwitchSession>(`/platform/switch-company/${sessionId}/end`, {
      method: "POST",
      token: context.token
    });
  }
};
