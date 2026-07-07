"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  type LucideIcon
} from "lucide-react";
import type { ErrorInfo, ReactNode } from "react";
import { Component, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useAuth } from "@/features/auth/auth-store";
import { useUiText } from "@/features/prototype/use-ui-text";
import {
  canManagePlatform,
  canManageSubscriptions,
  canReadAnalytics,
  canSuspendCompanies,
  canSwitchTenants,
  canUpdatePlatformSettings,
  canViewPlatform
} from "./platform-access";
import {
  type AnalyticsRange,
  type BillingInterval,
  type CompaniesFilters,
  type CompanyDetail,
  type CompanyListItem,
  type CompanyPlan,
  type CompanyStatus,
  type CompanySubscription,
  type PlansFilters,
  type PlatformContext,
  type PlatformOverview,
  type SubscriptionsFilters,
  type SubscriptionPlan,
  type SubscriptionStatus,
  type SwitchSession,
  type SwitchSessionsFilters,
  type SwitchSessionStatus,
  platformService
} from "./platform-service";

export type PlatformSection = "dashboard" | "companies" | "subscriptions" | "plans" | "analytics" | "settings" | "switch-sessions";

type Lang = "ar" | "en";
type Notice = { tone: "success" | "error" | "warning"; text: string } | null;
type ConfirmState = { title: string; message: string; actionLabel: string; onConfirm: () => void } | null;

const planOptions: CompanyPlan[] = ["STARTER", "PROFESSIONAL", "ENTERPRISE"];
const companyStatuses: CompanyStatus[] = ["ACTIVE", "TRIAL", "SUSPENDED"];
const subscriptionStatuses: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"];
const billingIntervals: BillingInterval[] = ["MONTHLY", "YEARLY"];
const switchStatuses: SwitchSessionStatus[] = ["ACTIVE", "ENDED", "REVOKED", "EXPIRED"];
const analyticsRanges: AnalyticsRange[] = ["7d", "30d", "90d", "365d"];

const chartColors = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed"];

export function PlatformView({ section }: { section: PlatformSection }) {
  return (
    <PlatformErrorBoundary>
      <PlatformContent section={section} />
    </PlatformErrorBoundary>
  );
}

class PlatformErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Platform portal render error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorState label="Platform view failed to render" />;
    }

    return this.props.children;
  }
}

function PlatformContent({ section }: { section: PlatformSection }) {
  const { lang } = useUiText();
  const labels = platformLabels(lang);
  const { accessToken, user } = useAuth();
  const [notice, setNotice] = useState<Notice>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const permissions = user?.permissions ?? [];
  const context = useMemo<PlatformContext | null>(() => (accessToken ? { token: accessToken } : null), [accessToken]);

  if (!accessToken || !user) {
    return <LoadingState label={labels.loading} />;
  }

  if (!canViewPlatform(permissions)) {
    return <PermissionDenied labels={labels} />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {notice && <NoticeBanner notice={notice} onClose={() => setNotice(null)} />}
      {section === "dashboard" && <DashboardSection context={context!} labels={labels} lang={lang} permissions={permissions} />}
      {section === "companies" && <CompaniesSection context={context!} labels={labels} lang={lang} permissions={permissions} setNotice={setNotice} setConfirm={setConfirm} />}
      {section === "subscriptions" && <SubscriptionsSection context={context!} labels={labels} lang={lang} permissions={permissions} setNotice={setNotice} />}
      {section === "plans" && <PlansSection context={context!} labels={labels} lang={lang} permissions={permissions} setNotice={setNotice} />}
      {section === "analytics" && <AnalyticsSection context={context!} labels={labels} lang={lang} permissions={permissions} />}
      {section === "settings" && <SettingsSection context={context!} labels={labels} permissions={permissions} setNotice={setNotice} />}
      {section === "switch-sessions" && <SwitchSessionsSection context={context!} labels={labels} lang={lang} permissions={permissions} setNotice={setNotice} setConfirm={setConfirm} />}
      {confirm && <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function DashboardSection({ context, labels, lang, permissions }: { context: PlatformContext; labels: Labels; lang: Lang; permissions: string[] }) {
  const analyticsAllowed = canReadAnalytics(permissions);
  const overviewQuery = useQuery({
    queryKey: ["platform", "overview"],
    queryFn: () => platformService.overview(context),
    enabled: analyticsAllowed
  });
  const usageQuery = useQuery({
    queryKey: ["platform", "usage", "30d"],
    queryFn: () => platformService.usage(context, { range: "30d" }),
    enabled: analyticsAllowed
  });
  const topCompaniesQuery = useQuery({
    queryKey: ["platform", "top-companies"],
    queryFn: () => platformService.topCompanies(context),
    enabled: analyticsAllowed
  });
  const distributionQuery = useQuery({
    queryKey: ["platform", "subscription-distribution"],
    queryFn: () => platformService.subscriptionDistribution(context),
    enabled: analyticsAllowed
  });

  if (!analyticsAllowed) return <PermissionDenied labels={labels} />;

  const overview = overviewQuery.data;
  const cards = [
    { label: labels.totalCompanies, value: overview?.companies.total, icon: Building2 },
    { label: labels.activeCompanies, value: overview?.companies.active, icon: CheckCircle2 },
    { label: labels.suspendedCompanies, value: overview?.companies.suspended, icon: ShieldAlert },
    { label: labels.trialCompanies, value: overview?.companies.trialing, icon: RefreshCcw },
    { label: labels.totalUsers, value: overview?.users.total, icon: Users },
    { label: labels.totalTasks, value: overview?.usage.totalTasks, icon: SlidersHorizontal },
    { label: labels.totalLeaveRequests, value: overview?.usage.totalLeaveRequests, icon: BarChart3 },
    { label: labels.totalEmails, value: overview?.usage.totalEmails, icon: KeyRound }
  ];

  return (
    <section className="space-y-5">
      <PageHeader title={labels.platformDashboard} description={labels.platformDashboardDescription} />
      {overviewQuery.isError && <ErrorState label={labels.error} />}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((card) => (
          <MetricCard key={card.label} label={card.label} value={overviewQuery.isLoading ? undefined : card.value} icon={card.icon} />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title={labels.recentUsage} className="xl:col-span-2">
          {usageQuery.isLoading ? <SkeletonBlock /> : usageQuery.isError ? <ErrorState label={labels.error} /> : <UsageCharts usage={usageQuery.data} labels={labels} />}
        </Panel>
        <Panel title={labels.subscriptionOverview}>
          {distributionQuery.isLoading ? (
            <SkeletonBlock />
          ) : distributionQuery.isError ? (
            <ErrorState label={labels.error} />
          ) : (
            <DistributionChart distribution={distributionQuery.data ?? emptyDistribution()} labels={labels} />
          )}
        </Panel>
      </div>
      <Panel title={labels.topCompanies}>
        {topCompaniesQuery.isLoading ? (
          <SkeletonRows />
        ) : topCompaniesQuery.isError ? (
          <ErrorState label={labels.error} />
        ) : (
          <TopCompaniesTable companies={topCompaniesQuery.data ?? []} labels={labels} lang={lang} />
        )}
      </Panel>
    </section>
  );
}

function CompaniesSection({
  context,
  labels,
  lang,
  permissions,
  setNotice,
  setConfirm
}: {
  context: PlatformContext;
  labels: Labels;
  lang: Lang;
  permissions: string[];
  setNotice: (notice: Notice) => void;
  setConfirm: (confirm: ConfirmState) => void;
}) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<CompaniesFilters>({ page: 1, limit: 10 });
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const canSuspend = canSuspendCompanies(permissions);
  const companiesQuery = useQuery({
    queryKey: ["platform", "companies", filters],
    queryFn: () => platformService.companies(context, filters)
  });
  const detailQuery = useQuery({
    queryKey: ["platform", "company", selectedCompanyId],
    queryFn: () => platformService.company(context, selectedCompanyId!),
    enabled: Boolean(selectedCompanyId)
  });
  const suspendMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => platformService.suspendCompany(context, id, reason),
    onSuccess() {
      setNotice({ tone: "success", text: labels.companySuspended });
      void queryClient.invalidateQueries({ queryKey: ["platform", "companies"] });
      void queryClient.invalidateQueries({ queryKey: ["platform", "company"] });
    },
    onError(error) {
      setNotice({ tone: "error", text: error.message });
    }
  });
  const activateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => platformService.activateCompany(context, id, reason),
    onSuccess() {
      setNotice({ tone: "success", text: labels.companyActivated });
      void queryClient.invalidateQueries({ queryKey: ["platform", "companies"] });
      void queryClient.invalidateQueries({ queryKey: ["platform", "company"] });
    },
    onError(error) {
      setNotice({ tone: "error", text: error.message });
    }
  });

  function updateFilter(key: keyof CompaniesFilters, value: string) {
    setFilters((current) => ({ ...current, page: 1, [key]: value }));
  }

  const companies = companiesQuery.data?.data ?? [];
  const meta = companiesQuery.data?.meta;

  return (
    <section className="space-y-5">
      <PageHeader title={labels.companies} description={labels.companiesDescription} />
      <Panel>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <SearchInput value={filters.search ?? ""} labels={labels} onChange={(value) => updateFilter("search", value)} />
          <SelectInput value={filters.status ?? ""} onChange={(value) => updateFilter("status", value)} options={companyStatuses} labels={labels} placeholder={labels.status} />
          <SelectInput value={filters.plan ?? ""} onChange={(value) => updateFilter("plan", value)} options={planOptions} labels={labels} placeholder={labels.plan} />
          <button onClick={() => setFilters({ page: 1, limit: 10 })} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
            {labels.reset}
          </button>
        </div>
      </Panel>
      <Panel title={labels.companyTable}>
        {companiesQuery.isLoading ? (
          <SkeletonRows />
        ) : companiesQuery.isError ? (
          <ErrorState label={labels.error} />
        ) : companies.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <TableHead>{labels.company}</TableHead>
                    <TableHead>{labels.plan}</TableHead>
                    <TableHead>{labels.status}</TableHead>
                    <TableHead>{labels.users}</TableHead>
                    <TableHead>{labels.domain}</TableHead>
                    <TableHead>{labels.updated}</TableHead>
                    <TableHead>{labels.actions}</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id} className="border-b border-border/60 last:border-0">
                      <TableCell>
                        <div className="font-semibold text-foreground">{company.name}</div>
                        <div className="text-xs text-muted-foreground">{company.billingEmail ?? company.slug}</div>
                      </TableCell>
                      <TableCell>
                        <StatusPill label={formatPlan(company.plan, labels)} tone="blue" />
                      </TableCell>
                      <TableCell>
                        <CompanyStatusBadge status={company.status} labels={labels} />
                      </TableCell>
                      <TableCell>{company.usersCount}</TableCell>
                      <TableCell>{company.primaryDomain ?? "-"}</TableCell>
                      <TableCell>{formatDate(company.updatedAt, lang)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <ActionButton onClick={() => setSelectedCompanyId(company.id)}>{labels.view}</ActionButton>
                          {company.status !== "SUSPENDED" ? (
                            <ActionButton
                              disabled={!canSuspend || suspendMutation.isPending}
                              tone="danger"
                              onClick={() =>
                                setConfirm({
                                  title: labels.suspendCompany,
                                  message: labels.confirmSuspend,
                                  actionLabel: labels.suspend,
                                  onConfirm: () => suspendMutation.mutate({ id: company.id, reason: "Platform action" })
                                })
                              }
                            >
                              {labels.suspend}
                            </ActionButton>
                          ) : (
                            <ActionButton
                              disabled={!canSuspend || activateMutation.isPending}
                              onClick={() =>
                                setConfirm({
                                  title: labels.activateCompany,
                                  message: labels.confirmActivate,
                                  actionLabel: labels.activate,
                                  onConfirm: () => activateMutation.mutate({ id: company.id, reason: "Platform action" })
                                })
                              }
                            >
                              {labels.activate}
                            </ActionButton>
                          )}
                        </div>
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={meta} labels={labels} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
          </>
        ) : (
          <EmptyState label={labels.empty} />
        )}
      </Panel>
      {selectedCompanyId && (
        <CompanyDrawer labels={labels} lang={lang} detail={detailQuery.data} loading={detailQuery.isLoading} error={detailQuery.isError} onClose={() => setSelectedCompanyId(null)} />
      )}
    </section>
  );
}

function SubscriptionsSection({ context, labels, lang, permissions, setNotice }: PlatformSectionProps) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<SubscriptionsFilters>({ page: 1, limit: 10 });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CompanySubscription | null>(null);
  const canManage = canManageSubscriptions(permissions);
  const subscriptionsQuery = useQuery({
    queryKey: ["platform", "subscriptions", filters],
    queryFn: () => platformService.subscriptions(context, filters)
  });
  const companiesQuery = useQuery({
    queryKey: ["platform", "companies", "subscription-options"],
    queryFn: () => platformService.companies(context, { page: 1, limit: 100 })
  });
  const plansQuery = useQuery({
    queryKey: ["platform", "plans", "subscription-options"],
    queryFn: () => platformService.plans(context, { page: 1, limit: 100, isActive: true })
  });
  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof platformService.createSubscription>[1]) => platformService.createSubscription(context, payload),
    onSuccess() {
      setNotice({ tone: "success", text: labels.subscriptionCreated });
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["platform", "subscriptions"] });
    },
    onError(error) {
      setNotice({ tone: "error", text: error.message });
    }
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof platformService.updateSubscription>[2] }) => platformService.updateSubscription(context, id, payload),
    onSuccess() {
      setNotice({ tone: "success", text: labels.subscriptionUpdated });
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["platform", "subscriptions"] });
    },
    onError(error) {
      setNotice({ tone: "error", text: error.message });
    }
  });

  const subscriptions = subscriptionsQuery.data?.data ?? [];

  return (
    <section className="space-y-5">
      <PageHeader
        title={labels.subscriptions}
        description={labels.subscriptionsDescription}
        action={
          <ActionButton disabled={!canManage} onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
            {labels.createSubscription}
          </ActionButton>
        }
      />
      <Panel>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <SelectInput value={filters.companyId ?? ""} onChange={(value) => setFilters((current) => ({ ...current, page: 1, companyId: value }))} options={(companiesQuery.data?.data ?? []).map((company) => ({ value: company.id, label: company.name }))} labels={labels} placeholder={labels.company} />
          <SelectInput value={filters.planId ?? ""} onChange={(value) => setFilters((current) => ({ ...current, page: 1, planId: value }))} options={(plansQuery.data?.data ?? []).map((plan) => ({ value: plan.id, label: plan.name }))} labels={labels} placeholder={labels.plan} />
          <SelectInput value={filters.status ?? ""} onChange={(value) => setFilters((current) => ({ ...current, page: 1, status: value as SubscriptionStatus | "" }))} options={subscriptionStatuses} labels={labels} placeholder={labels.status} />
          <SelectInput value={filters.billingInterval ?? ""} onChange={(value) => setFilters((current) => ({ ...current, page: 1, billingInterval: value as BillingInterval | "" }))} options={billingIntervals} labels={labels} placeholder={labels.billing} />
        </div>
      </Panel>
      <Panel title={labels.subscriptions}>
        {subscriptionsQuery.isLoading ? (
          <SkeletonRows />
        ) : subscriptionsQuery.isError ? (
          <ErrorState label={labels.error} />
        ) : subscriptions.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <TableHead>{labels.company}</TableHead>
                    <TableHead>{labels.plan}</TableHead>
                    <TableHead>{labels.seats}</TableHead>
                    <TableHead>{labels.status}</TableHead>
                    <TableHead>{labels.billing}</TableHead>
                    <TableHead>{labels.trialEnd}</TableHead>
                    <TableHead>{labels.actions}</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((subscription) => (
                    <tr key={subscription.id} className="border-b border-border/60 last:border-0">
                      <TableCell>{subscription.company.name}</TableCell>
                      <TableCell>{subscription.plan.name}</TableCell>
                      <TableCell>{subscription.seats}</TableCell>
                      <TableCell>
                        <StatusPill label={formatSubscriptionStatus(subscription.status, labels)} tone={subscription.status === "ACTIVE" ? "green" : "amber"} />
                      </TableCell>
                      <TableCell>{formatBilling(subscription.billingInterval, labels)}</TableCell>
                      <TableCell>{subscription.trialEndsAt ? formatDate(subscription.trialEndsAt, lang) : "-"}</TableCell>
                      <TableCell>
                        <ActionButton disabled={!canManage} onClick={() => setEditing(subscription)}>
                          {labels.edit}
                        </ActionButton>
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={subscriptionsQuery.data?.meta} labels={labels} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
          </>
        ) : (
          <EmptyState label={labels.empty} />
        )}
      </Panel>
      {createOpen && (
        <SubscriptionDialog
          labels={labels}
          companies={companiesQuery.data?.data ?? []}
          plans={plansQuery.data?.data ?? []}
          onClose={() => setCreateOpen(false)}
          onSubmit={(payload) => createMutation.mutate(payload)}
          busy={createMutation.isPending}
        />
      )}
      {editing && (
        <SubscriptionDialog
          labels={labels}
          companies={companiesQuery.data?.data ?? []}
          plans={plansQuery.data?.data ?? []}
          subscription={editing}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => updateMutation.mutate({ id: editing.id, payload })}
          busy={updateMutation.isPending}
        />
      )}
    </section>
  );
}

function PlansSection({ context, labels, lang, permissions, setNotice }: PlatformSectionProps) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<PlansFilters>({ page: 1, limit: 10 });
  const [createOpen, setCreateOpen] = useState(false);
  const canManage = canManageSubscriptions(permissions);
  const plansQuery = useQuery({
    queryKey: ["platform", "plans", filters],
    queryFn: () => platformService.plans(context, filters)
  });
  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof platformService.createPlan>[1]) => platformService.createPlan(context, payload),
    onSuccess() {
      setNotice({ tone: "success", text: labels.planCreated });
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["platform", "plans"] });
    },
    onError(error) {
      setNotice({ tone: "error", text: error.message });
    }
  });
  const plans = plansQuery.data?.data ?? [];

  return (
    <section className="space-y-5">
      <PageHeader
        title={labels.plans}
        description={labels.plansDescription}
        action={
          <ActionButton disabled={!canManage} onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
            {labels.createPlan}
          </ActionButton>
        }
      />
      <Panel>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <SearchInput value={filters.search ?? ""} labels={labels} onChange={(search) => setFilters((current) => ({ ...current, page: 1, search }))} />
          <SelectInput value={filters.tier ?? ""} onChange={(tier) => setFilters((current) => ({ ...current, page: 1, tier: tier as CompanyPlan | "" }))} options={planOptions} labels={labels} placeholder={labels.tier} />
          <SelectInput value={String(filters.isActive ?? "")} onChange={(value) => setFilters((current) => ({ ...current, page: 1, isActive: value === "" ? "" : value === "true" }))} options={[{ value: "true", label: labels.active }, { value: "false", label: labels.inactive }]} labels={labels} placeholder={labels.status} />
          <button onClick={() => setFilters({ page: 1, limit: 10 })} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
            {labels.reset}
          </button>
        </div>
      </Panel>
      <Panel title={labels.plans}>
        {plansQuery.isLoading ? (
          <SkeletonRows />
        ) : plansQuery.isError ? (
          <ErrorState label={labels.error} />
        ) : plans.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <TableHead>{labels.code}</TableHead>
                    <TableHead>{labels.name}</TableHead>
                    <TableHead>{labels.tier}</TableHead>
                    <TableHead>{labels.monthlyPrice}</TableHead>
                    <TableHead>{labels.yearlyPrice}</TableHead>
                    <TableHead>{labels.currency}</TableHead>
                    <TableHead>{labels.status}</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr key={plan.id} className="border-b border-border/60 last:border-0">
                      <TableCell>{plan.code}</TableCell>
                      <TableCell>{plan.name}</TableCell>
                      <TableCell>{formatPlan(plan.tier, labels)}</TableCell>
                      <TableCell>{formatMoney(plan.monthlyPrice, plan.currency, lang)}</TableCell>
                      <TableCell>{formatMoney(plan.yearlyPrice, plan.currency, lang)}</TableCell>
                      <TableCell>{plan.currency}</TableCell>
                      <TableCell>
                        <StatusPill label={plan.isActive ? labels.active : labels.inactive} tone={plan.isActive ? "green" : "slate"} />
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={plansQuery.data?.meta} labels={labels} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
          </>
        ) : (
          <EmptyState label={labels.empty} />
        )}
      </Panel>
      {createOpen && <PlanDialog labels={labels} onClose={() => setCreateOpen(false)} onSubmit={(payload) => createMutation.mutate(payload)} busy={createMutation.isPending} />}
    </section>
  );
}

function AnalyticsSection({ context, labels, lang, permissions }: { context: PlatformContext; labels: Labels; lang: Lang; permissions: string[] }) {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const allowed = canReadAnalytics(permissions);
  const overviewQuery = useQuery({
    queryKey: ["platform", "analytics", "overview"],
    queryFn: () => platformService.overview(context),
    enabled: allowed
  });
  const usageQuery = useQuery({
    queryKey: ["platform", "analytics", "usage", range],
    queryFn: () => platformService.usage(context, { range }),
    enabled: allowed
  });
  const topCompaniesQuery = useQuery({
    queryKey: ["platform", "analytics", "top-companies"],
    queryFn: () => platformService.topCompanies(context),
    enabled: allowed
  });
  const distributionQuery = useQuery({
    queryKey: ["platform", "analytics", "subscription-distribution"],
    queryFn: () => platformService.subscriptionDistribution(context),
    enabled: allowed
  });

  if (!allowed) return <PermissionDenied labels={labels} />;

  return (
    <section className="space-y-5">
      <PageHeader title={labels.analytics} description={labels.analyticsDescription} />
      <div className="flex flex-wrap gap-2">
        {analyticsRanges.map((item) => (
          <button key={item} onClick={() => setRange(item)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${range === item ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
            {item}
          </button>
        ))}
      </div>
      {overviewQuery.data && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <MetricCard label={labels.totalCompanies} value={overviewQuery.data.companies.total} icon={Building2} />
          <MetricCard label={labels.totalUsers} value={overviewQuery.data.users.total} icon={Users} />
          <MetricCard label={labels.totalTasks} value={overviewQuery.data.usage.totalTasks} icon={SlidersHorizontal} />
          <MetricCard label={labels.totalEmails} value={overviewQuery.data.usage.totalEmails} icon={KeyRound} />
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title={labels.overview} className="xl:col-span-2">
          {usageQuery.isLoading ? <SkeletonBlock /> : usageQuery.isError ? <ErrorState label={labels.error} /> : <UsageCharts usage={usageQuery.data} labels={labels} />}
        </Panel>
        <Panel title={labels.subscriptionDistribution}>
          {distributionQuery.isLoading ? (
            <SkeletonBlock />
          ) : distributionQuery.isError ? (
            <ErrorState label={labels.error} />
          ) : (
            <DistributionChart distribution={distributionQuery.data ?? emptyDistribution()} labels={labels} />
          )}
        </Panel>
      </div>
      <Panel title={labels.topCompanies}>
        {topCompaniesQuery.isLoading ? (
          <SkeletonRows />
        ) : topCompaniesQuery.isError ? (
          <ErrorState label={labels.error} />
        ) : (
          <TopCompaniesTable companies={topCompaniesQuery.data ?? []} labels={labels} lang={lang} />
        )}
      </Panel>
    </section>
  );
}

function SettingsSection({ context, labels, permissions, setNotice }: Omit<PlatformSectionProps, "lang">) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const canUpdate = canUpdatePlatformSettings(permissions);
  const settingsQuery = useQuery({
    queryKey: ["platform", "settings"],
    queryFn: () => platformService.settings(context)
  });
  const updateMutation = useMutation({
    mutationFn: (payload: { key: string; value: unknown; valueType?: string; description?: string; isSecret?: boolean }) =>
      platformService.updateSetting(context, payload.key, payload),
    onSuccess() {
      setNotice({ tone: "success", text: labels.settingUpdated });
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["platform", "settings"] });
    },
    onError(error) {
      setNotice({ tone: "error", text: error.message });
    }
  });
  const settings = settingsQuery.data?.data ?? [];

  return (
    <section className="space-y-5">
      <PageHeader
        title={labels.settings}
        description={labels.settingsDescription}
        action={
          <ActionButton disabled={!canUpdate} onClick={() => setEditing(true)} icon={<Plus className="h-4 w-4" />}>
            {labels.updateSetting}
          </ActionButton>
        }
      />
      <Panel title={labels.settings}>
        {settingsQuery.isLoading ? (
          <SkeletonRows />
        ) : settingsQuery.isError ? (
          <ErrorState label={labels.error} />
        ) : settings.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[560px] w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <TableHead>{labels.key}</TableHead>
                  <TableHead>{labels.secret}</TableHead>
                </tr>
              </thead>
              <tbody>
                {settings.map((setting) => (
                  <tr key={setting.id} className="border-b border-border/60 last:border-0">
                    <TableCell>{setting.key}</TableCell>
                    <TableCell>{setting.isSecret ? labels.yes : labels.no}</TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label={labels.noSettings} />
        )}
      </Panel>
      {editing && <SettingDialog labels={labels} onClose={() => setEditing(false)} onSubmit={(payload) => updateMutation.mutate(payload)} busy={updateMutation.isPending} />}
    </section>
  );
}

function SwitchSessionsSection({
  context,
  labels,
  lang,
  permissions,
  setNotice,
  setConfirm
}: {
  context: PlatformContext;
  labels: Labels;
  lang: Lang;
  permissions: string[];
  setNotice: (notice: Notice) => void;
  setConfirm: (confirm: ConfirmState) => void;
}) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<SwitchSessionsFilters>({ page: 1, limit: 10 });
  const [createOpen, setCreateOpen] = useState(false);
  const [switchResult, setSwitchResult] = useState<{ companyName: string; expiresAt: string; token: string } | null>(null);
  const canSwitch = canSwitchTenants(permissions);
  const sessionsQuery = useQuery({
    queryKey: ["platform", "switch-sessions", filters],
    queryFn: () => platformService.switchSessions(context, filters)
  });
  const companiesQuery = useQuery({
    queryKey: ["platform", "companies", "switch-options"],
    queryFn: () => platformService.companies(context, { page: 1, limit: 100, status: "ACTIVE" })
  });
  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof platformService.createSwitchSession>[1]) => platformService.createSwitchSession(context, payload),
    onSuccess(result) {
      setNotice({ tone: "success", text: labels.switchSessionCreated });
      setCreateOpen(false);
      setSwitchResult({ companyName: result.session.targetCompany.name, expiresAt: result.expiresAt, token: result.token });
      void queryClient.invalidateQueries({ queryKey: ["platform", "switch-sessions"] });
    },
    onError(error) {
      setNotice({ tone: "error", text: error.message });
    }
  });
  const endMutation = useMutation({
    mutationFn: (id: string) => platformService.endSwitchSession(context, id),
    onSuccess() {
      setNotice({ tone: "success", text: labels.switchSessionEnded });
      void queryClient.invalidateQueries({ queryKey: ["platform", "switch-sessions"] });
    },
    onError(error) {
      setNotice({ tone: "error", text: error.message });
    }
  });
  const sessions = sessionsQuery.data?.data ?? [];

  return (
    <section className="space-y-5">
      <PageHeader
        title={labels.switchSessions}
        description={labels.switchSessionsDescription}
        action={
          <ActionButton disabled={!canSwitch} onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
            {labels.createSwitchSession}
          </ActionButton>
        }
      />
      {switchResult && <SwitchTokenPanel result={switchResult} labels={labels} lang={lang} onClose={() => setSwitchResult(null)} setNotice={setNotice} />}
      <Panel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SelectInput value={filters.companyId ?? ""} onChange={(value) => setFilters((current) => ({ ...current, page: 1, companyId: value }))} options={(companiesQuery.data?.data ?? []).map((company) => ({ value: company.id, label: company.name }))} labels={labels} placeholder={labels.company} />
          <SelectInput value={filters.status ?? ""} onChange={(value) => setFilters((current) => ({ ...current, page: 1, status: value as SwitchSessionStatus | "" }))} options={switchStatuses} labels={labels} placeholder={labels.status} />
          <button onClick={() => setFilters({ page: 1, limit: 10 })} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
            {labels.reset}
          </button>
        </div>
      </Panel>
      <Panel title={labels.switchSessions}>
        {sessionsQuery.isLoading ? (
          <SkeletonRows />
        ) : sessionsQuery.isError ? (
          <ErrorState label={labels.error} />
        ) : sessions.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <TableHead>{labels.company}</TableHead>
                    <TableHead>{labels.actor}</TableHead>
                    <TableHead>{labels.started}</TableHead>
                    <TableHead>{labels.expires}</TableHead>
                    <TableHead>{labels.status}</TableHead>
                    <TableHead>{labels.actions}</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} className="border-b border-border/60 last:border-0">
                      <TableCell>{session.targetCompany.name}</TableCell>
                      <TableCell>
                        <div className="font-semibold">{session.actorUser.name}</div>
                        <div className="text-xs text-muted-foreground">{session.actorUser.email}</div>
                      </TableCell>
                      <TableCell>{formatDate(session.startedAt, lang)}</TableCell>
                      <TableCell>{formatDate(session.expiresAt, lang)}</TableCell>
                      <TableCell>
                        <StatusPill label={formatSwitchStatus(session.status, labels)} tone={session.status === "ACTIVE" ? "green" : "slate"} />
                      </TableCell>
                      <TableCell>
                        <ActionButton
                          disabled={!canSwitch || session.status !== "ACTIVE" || endMutation.isPending}
                          tone="danger"
                          onClick={() =>
                            setConfirm({
                              title: labels.endSession,
                              message: labels.confirmEndSession,
                              actionLabel: labels.endSession,
                              onConfirm: () => endMutation.mutate(session.id)
                            })
                          }
                        >
                          {labels.endSession}
                        </ActionButton>
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={sessionsQuery.data?.meta} labels={labels} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
          </>
        ) : (
          <EmptyState label={labels.empty} />
        )}
      </Panel>
      {createOpen && (
        <SwitchSessionDialog labels={labels} companies={companiesQuery.data?.data ?? []} onClose={() => setCreateOpen(false)} onSubmit={(payload) => createMutation.mutate(payload)} busy={createMutation.isPending} />
      )}
    </section>
  );
}

type PlatformSectionProps = {
  context: PlatformContext;
  labels: Labels;
  lang: Lang;
  permissions: string[];
  setNotice: (notice: Notice) => void;
};

function UsageCharts({ usage, labels }: { usage?: { companies: Array<{ date: string; value: number }>; users: Array<{ date: string; value: number }>; tasks: Array<{ date: string; value: number }>; emails: Array<{ date: string; value: number }> }; labels: Labels }) {
  if (!usage) return <EmptyState label={labels.empty} />;
  const data = usage.users.map((point, index) => ({
    date: point.date.slice(5),
    companies: usage.companies[index]?.value ?? 0,
    users: point.value,
    tasks: usage.tasks[index]?.value ?? 0,
    emails: usage.emails[index]?.value ?? 0
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <LinePanel title={labels.companiesGrowth} data={data} dataKey="companies" color="#2563eb" />
      <LinePanel title={labels.usersGrowth} data={data} dataKey="users" color="#16a34a" />
      <LinePanel title={labels.tasksGrowth} data={data} dataKey="tasks" color="#f59e0b" />
      <LinePanel title={labels.emailGrowth} data={data} dataKey="emails" color="#dc2626" />
    </div>
  );
}

function LinePanel({ title, data, dataKey, color }: { title: string; data: Array<Record<string, string | number>>; dataKey: string; color: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-xs font-bold text-muted-foreground mb-2">{title}</div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={24} />
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.75rem", fontSize: "12px" }} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DistributionChart({ distribution, labels }: { distribution: Record<CompanyPlan, number>; labels: Labels }) {
  const data = planOptions.map((plan, index) => ({ name: formatPlan(plan, labels), value: distribution[plan] ?? 0, fill: chartColors[index] }));

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={74} strokeWidth={3} stroke="var(--card)">
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.75rem", fontSize: "12px" }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: item.fill }} />
              {item.name}
            </span>
            <span className="font-bold">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopCompaniesTable({ companies, labels, lang }: { companies: Array<{ companyId: string; companyName: string; users: number; tasks: number; emails: number; storageBytes: number; plan: CompanyPlan }>; labels: Labels; lang: Lang }) {
  if (!companies.length) return <EmptyState label={labels.empty} />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[760px] w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <TableHead>{labels.company}</TableHead>
            <TableHead>{labels.users}</TableHead>
            <TableHead>{labels.totalTasks}</TableHead>
            <TableHead>{labels.totalEmails}</TableHead>
            <TableHead>{labels.storage}</TableHead>
            <TableHead>{labels.plan}</TableHead>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.companyId} className="border-b border-border/60 last:border-0">
              <TableCell>{company.companyName}</TableCell>
              <TableCell>{company.users}</TableCell>
              <TableCell>{company.tasks}</TableCell>
              <TableCell>{company.emails}</TableCell>
              <TableCell>{formatBytes(company.storageBytes, lang)}</TableCell>
              <TableCell>{formatPlan(company.plan, labels)}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompanyDrawer({ labels, lang, detail, loading, error, onClose }: { labels: Labels; lang: Lang; detail?: CompanyDetail; loading: boolean; error: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40">
      <button className="absolute inset-0 bg-black/30" onClick={onClose} aria-label={labels.close} />
      <aside className="absolute end-0 top-0 h-full w-full max-w-xl bg-card border-s border-border shadow-xl overflow-auto">
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{labels.companyDetails}</h2>
            <p className="text-xs text-muted-foreground">{labels.companyDetailsDescription}</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
            {labels.close}
          </button>
        </div>
        <div className="p-4 space-y-4">
          {loading ? (
            <SkeletonRows />
          ) : error || !detail ? (
            <ErrorState label={labels.error} />
          ) : (
            <>
              <Panel title={detail.company.name}>
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem label={labels.plan} value={formatPlan(detail.company.plan, labels)} />
                  <InfoItem label={labels.status} value={formatCompanyStatus(detail.company.status, labels)} />
                  <InfoItem label={labels.domain} value={detail.company.primaryDomain ?? "-"} />
                  <InfoItem label={labels.billingEmail} value={detail.company.billingEmail ?? "-"} />
                </div>
              </Panel>
              <Panel title={labels.latestSubscription}>
                {detail.subscription ? (
                  <div className="grid grid-cols-2 gap-3">
                    <InfoItem label={labels.plan} value={detail.subscription.plan.name} />
                    <InfoItem label={labels.status} value={formatSubscriptionStatus(detail.subscription.status, labels)} />
                    <InfoItem label={labels.seats} value={String(detail.subscription.seats)} />
                    <InfoItem label={labels.billing} value={formatBilling(detail.subscription.billingInterval, labels)} />
                  </div>
                ) : (
                  <EmptyState label={labels.empty} />
                )}
              </Panel>
              <Panel title={labels.statistics}>
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem label={labels.users} value={String(detail.usersCount)} />
                  <InfoItem label={labels.departments} value={String(detail.departmentsCount)} />
                  <InfoItem label={labels.totalTasks} value={String(detail.tasksCount)} />
                  <InfoItem label={labels.storage} value={formatBytes(detail.storageUsage, lang)} />
                  <InfoItem label={labels.lastActivity} value={detail.lastActivityAt ? formatDate(detail.lastActivityAt, lang) : "-"} />
                </div>
              </Panel>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function PlanDialog({ labels, onClose, onSubmit, busy }: { labels: Labels; onClose: () => void; onSubmit: (payload: Parameters<typeof platformService.createPlan>[1]) => void; busy: boolean }) {
  return (
    <Modal title={labels.createPlan} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const limits = parseJsonObject(String(form.get("limitsJson") || "{}"));
          onSubmit({
            code: String(form.get("code") || ""),
            name: String(form.get("name") || ""),
            tier: String(form.get("tier") || "STARTER") as CompanyPlan,
            monthlyPrice: numberFromForm(form, "monthlyPrice"),
            yearlyPrice: numberFromForm(form, "yearlyPrice"),
            currency: String(form.get("currency") || "USD"),
            maxUsers: optionalNumber(limits.maxUsers),
            maxStorageMb: optionalNumber(limits.maxStorageMb),
            maxCompanies: optionalNumber(limits.maxCompanies),
            features: parseJsonObject(String(form.get("featuresJson") || "{}")),
            isActive: form.get("isActive") === "on"
          });
        }}
      >
        <FormGrid>
          <TextField name="code" label={labels.code} required />
          <TextField name="name" label={labels.name} required />
          <SelectField name="tier" label={labels.tier} options={planOptions.map((plan) => ({ value: plan, label: formatPlan(plan, labels) }))} />
          <TextField name="currency" label={labels.currency} defaultValue="USD" />
          <TextField name="monthlyPrice" label={labels.monthlyPrice} type="number" defaultValue="0" />
          <TextField name="yearlyPrice" label={labels.yearlyPrice} type="number" defaultValue="0" />
        </FormGrid>
        <TextareaField name="featuresJson" label={labels.featuresJson} defaultValue='{"emailCenter":true}' />
        <TextareaField name="limitsJson" label={labels.limitsJson} defaultValue='{"maxUsers":100,"maxStorageMb":102400}' />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input name="isActive" type="checkbox" defaultChecked className="h-4 w-4" />
          {labels.active}
        </label>
        <DialogActions labels={labels} busy={busy} onClose={onClose} />
      </form>
    </Modal>
  );
}

function SubscriptionDialog({
  labels,
  companies,
  plans,
  subscription,
  onClose,
  onSubmit,
  busy
}: {
  labels: Labels;
  companies: CompanyListItem[];
  plans: SubscriptionPlan[];
  subscription?: CompanySubscription;
  onClose: () => void;
  onSubmit: (payload: Parameters<typeof platformService.createSubscription>[1]) => void;
  busy: boolean;
}) {
  return (
    <Modal title={subscription ? labels.editSubscription : labels.createSubscription} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onSubmit({
            companyId: String(form.get("companyId") || subscription?.companyId || ""),
            planId: String(form.get("planId") || subscription?.planId || ""),
            status: String(form.get("status") || subscription?.status || "TRIALING") as SubscriptionStatus,
            billingInterval: String(form.get("billingInterval") || subscription?.billingInterval || "MONTHLY") as BillingInterval,
            seats: numberFromForm(form, "seats"),
            trialEndsAt: String(form.get("trialEndsAt") || "") || undefined,
            currentPeriodEnd: String(form.get("currentPeriodEnd") || "") || undefined
          });
        }}
      >
        <FormGrid>
          <SelectField name="companyId" label={labels.company} defaultValue={subscription?.companyId} disabled={Boolean(subscription)} options={companies.map((company) => ({ value: company.id, label: company.name }))} />
          <SelectField name="planId" label={labels.plan} defaultValue={subscription?.planId} options={plans.map((plan) => ({ value: plan.id, label: plan.name }))} />
          <SelectField name="status" label={labels.status} defaultValue={subscription?.status} options={subscriptionStatuses.map((status) => ({ value: status, label: formatSubscriptionStatus(status, labels) }))} />
          <SelectField name="billingInterval" label={labels.billing} defaultValue={subscription?.billingInterval} options={billingIntervals.map((item) => ({ value: item, label: formatBilling(item, labels) }))} />
          <TextField name="seats" label={labels.seats} type="number" defaultValue={subscription?.seats ? String(subscription.seats) : "1"} />
          <TextField name="trialEndsAt" label={labels.trialEnd} type="datetime-local" />
          <TextField name="currentPeriodEnd" label={labels.currentPeriodEnd} type="datetime-local" />
        </FormGrid>
        <DialogActions labels={labels} busy={busy} onClose={onClose} />
      </form>
    </Modal>
  );
}

function SettingDialog({ labels, onClose, onSubmit, busy }: { labels: Labels; onClose: () => void; onSubmit: (payload: { key: string; value: unknown; valueType?: string; description?: string; isSecret?: boolean }) => void; busy: boolean }) {
  return (
    <Modal title={labels.updateSetting} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onSubmit({
            key: String(form.get("key") || ""),
            value: parseSettingValue(String(form.get("value") || ""), String(form.get("valueType") || "STRING")),
            valueType: String(form.get("valueType") || "STRING"),
            description: String(form.get("description") || "") || undefined,
            isSecret: form.get("isSecret") === "on"
          });
        }}
      >
        <FormGrid>
          <TextField name="key" label={labels.key} required />
          <SelectField name="valueType" label={labels.type} options={["STRING", "NUMBER", "BOOLEAN", "JSON", "SECRET"].map((value) => ({ value, label: value }))} />
        </FormGrid>
        <TextareaField name="value" label={labels.value} required />
        <TextareaField name="description" label={labels.description} />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input name="isSecret" type="checkbox" className="h-4 w-4" />
          {labels.secret}
        </label>
        <DialogActions labels={labels} busy={busy} onClose={onClose} />
      </form>
    </Modal>
  );
}

function SwitchSessionDialog({ labels, companies, onClose, onSubmit, busy }: { labels: Labels; companies: CompanyListItem[]; onClose: () => void; onSubmit: (payload: Parameters<typeof platformService.createSwitchSession>[1]) => void; busy: boolean }) {
  return (
    <Modal title={labels.createSwitchSession} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onSubmit({
            companyId: String(form.get("companyId") || ""),
            reason: String(form.get("reason") || "") || undefined,
            expiresAt: String(form.get("expiresAt") || "") || undefined
          });
        }}
      >
        <SelectField name="companyId" label={labels.company} options={companies.map((company) => ({ value: company.id, label: company.name }))} />
        <TextareaField name="reason" label={labels.reason} />
        <TextField name="expiresAt" label={labels.expires} type="datetime-local" />
        <DialogActions labels={labels} busy={busy} onClose={onClose} />
      </form>
    </Modal>
  );
}

function SwitchTokenPanel({
  result,
  labels,
  lang,
  onClose,
  setNotice
}: {
  result: { companyName: string; expiresAt: string; token: string };
  labels: Labels;
  lang: Lang;
  onClose: () => void;
  setNotice: (notice: Notice) => void;
}) {
  async function copyToken() {
    await navigator.clipboard.writeText(result.token);
    setNotice({ tone: "success", text: labels.tokenCopied });
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="font-bold">{labels.switchTokenCreated}</div>
            <div className="text-sm opacity-80">
              {result.companyName} · {labels.expires}: {formatDate(result.expiresAt, lang)}
            </div>
          </div>
          <div className="rounded-lg bg-white/60 dark:bg-black/20 p-3 font-mono text-xs break-all">{result.token}</div>
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={copyToken} icon={<Copy className="h-4 w-4" />}>
              {labels.copyToken}
            </ActionButton>
            <ActionButton onClick={() => window.open(`/${lang}/dashboard`, "_blank")} icon={<ExternalLink className="h-4 w-4" />}>
              {labels.openCompany}
            </ActionButton>
            <ActionButton onClick={onClose}>{labels.close}</ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Panel({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-card rounded-2xl border border-border p-4 sm:p-5 ${className}`}>
      {title && <h2 className="text-sm font-bold text-foreground mb-4">{title}</h2>}
      {children}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value?: number; icon: LucideIcon }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {value === undefined ? <div className="h-8 w-20 animate-pulse rounded bg-muted" /> : <div className="text-3xl font-bold text-foreground">{value}</div>}
      <div className="text-xs font-semibold text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function SearchInput({ value, labels, onChange }: { value: string; labels: Labels; onChange: (value: string) => void }) {
  return (
    <label className="relative block">
      <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={labels.search} className="w-full rounded-xl border border-border bg-input-background py-2 ps-9 pe-3 text-sm outline-none focus:border-primary" />
    </label>
  );
}

function SelectInput({
  value,
  onChange,
  options,
  labels,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<string | { value: string; label: string }>;
  labels: Labels;
  placeholder: string;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-border bg-input-background px-3 py-2 text-sm outline-none focus:border-primary">
      <option value="">{placeholder}</option>
      {options.map((option) => {
        const item = typeof option === "string" ? { value: option, label: formatKnownValue(option, labels) } : option;
        return (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        );
      })}
    </select>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/35" onClick={onClose} aria-label={title} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border border-border bg-card shadow-xl">
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function ConfirmDialog({ state, onClose }: { state: NonNullable<ConfirmState>; onClose: () => void }) {
  return (
    <Modal title={state.title} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{state.message}</p>
        <div className="flex justify-end gap-2">
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton
            tone="danger"
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
          >
            {state.actionLabel}
          </ActionButton>
        </div>
      </div>
    </Modal>
  );
}

function DialogActions({ labels, busy, onClose }: { labels: Labels; busy: boolean; onClose: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <ActionButton type="button" onClick={onClose}>
        {labels.cancel}
      </ActionButton>
      <ActionButton type="submit" disabled={busy} icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}>
        {labels.save}
      </ActionButton>
    </div>
  );
}

function TextField({ name, label, type = "text", defaultValue, required, disabled }: { name: string; label: string; type?: string; defaultValue?: string; required?: boolean; disabled?: boolean }) {
  return (
    <label className="space-y-1 text-sm font-semibold">
      <span>{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} required={required} disabled={disabled} className="w-full rounded-xl border border-border bg-input-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60" />
    </label>
  );
}

function TextareaField({ name, label, defaultValue, required }: { name: string; label: string; defaultValue?: string; required?: boolean }) {
  return (
    <label className="space-y-1 text-sm font-semibold block">
      <span>{label}</span>
      <textarea name={name} defaultValue={defaultValue} required={required} rows={4} className="w-full rounded-xl border border-border bg-input-background px-3 py-2 text-sm outline-none focus:border-primary" />
    </label>
  );
}

function SelectField({ name, label, options, defaultValue, disabled }: { name: string; label: string; options: Array<{ value: string; label: string }>; defaultValue?: string; disabled?: boolean }) {
  return (
    <label className="space-y-1 text-sm font-semibold">
      <span>{label}</span>
      <select name={name} defaultValue={defaultValue} disabled={disabled} className="w-full rounded-xl border border-border bg-input-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}

function ActionButton({
  children,
  onClick,
  disabled,
  type = "button",
  tone = "default",
  icon
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  tone?: "default" | "danger";
  icon?: ReactNode;
}) {
  const cls =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-900/20"
      : "border-border bg-card text-foreground hover:bg-muted";

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 ${cls}`}>
      {icon}
      {children}
    </button>
  );
}

function PermissionDenied({ labels }: { labels: Labels }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500 mb-3" />
        <h1 className="text-lg font-bold">{labels.permissionDenied}</h1>
        <p className="text-sm text-muted-foreground mt-2">{labels.permissionDeniedDescription}</p>
      </div>
    </div>
  );
}

function NoticeBanner({ notice, onClose }: { notice: NonNullable<Notice>; onClose: () => void }) {
  const cls =
    notice.tone === "success"
      ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300"
      : notice.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300"
        : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300";

  return (
    <div className={`fixed top-16 end-4 z-50 max-w-md rounded-xl border px-4 py-3 shadow-lg ${cls}`}>
      <div className="flex items-start gap-3">
        <span className="text-sm font-semibold">{notice.text}</span>
        <button onClick={onClose} className="text-sm opacity-70 hover:opacity-100">
          ×
        </button>
      </div>
    </div>
  );
}

function SkeletonBlock() {
  return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

function TableHead({ children }: { children: ReactNode }) {
  return <th className="px-3 py-3 text-start font-bold">{children}</th>;
}

function TableCell({ children }: { children: ReactNode }) {
  return <td className="px-3 py-3 align-middle">{children}</td>;
}

function StatusPill({ label, tone }: { label: string; tone: "green" | "amber" | "blue" | "slate" }) {
  const cls: Record<typeof tone, string> = {
    green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
  };

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${cls[tone]}`}>{label}</span>;
}

function CompanyStatusBadge({ status, labels }: { status: CompanyStatus; labels: Labels }) {
  const tone = status === "ACTIVE" ? "green" : status === "SUSPENDED" ? "slate" : "amber";
  return <StatusPill label={formatCompanyStatus(status, labels)} tone={tone} />;
}

function Pagination({ meta, labels, onPage }: { meta?: { page: number; limit: number; total: number }; labels: Labels; onPage: (page: number) => void }) {
  if (!meta) return null;
  const pages = Math.max(1, Math.ceil(meta.total / meta.limit));

  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        {labels.total}: {meta.total}
      </span>
      <div className="flex items-center gap-2">
        <ActionButton disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          {labels.previous}
        </ActionButton>
        <span className="text-muted-foreground">
          {meta.page} / {pages}
        </span>
        <ActionButton disabled={meta.page >= pages} onClick={() => onPage(meta.page + 1)}>
          {labels.next}
        </ActionButton>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-bold text-foreground break-words">{value}</div>
    </div>
  );
}

function emptyDistribution(): Record<CompanyPlan, number> {
  return { STARTER: 0, PROFESSIONAL: 0, ENTERPRISE: 0 };
}

function formatKnownValue(value: string, labels: Labels) {
  if (planOptions.includes(value as CompanyPlan)) return formatPlan(value as CompanyPlan, labels);
  if (companyStatuses.includes(value as CompanyStatus)) return formatCompanyStatus(value as CompanyStatus, labels);
  if (subscriptionStatuses.includes(value as SubscriptionStatus)) return formatSubscriptionStatus(value as SubscriptionStatus, labels);
  if (billingIntervals.includes(value as BillingInterval)) return formatBilling(value as BillingInterval, labels);
  if (switchStatuses.includes(value as SwitchSessionStatus)) return formatSwitchStatus(value as SwitchSessionStatus, labels);
  return value;
}

function formatPlan(plan: CompanyPlan, labels: Labels) {
  return labels.plansMap[plan] ?? plan;
}

function formatCompanyStatus(status: CompanyStatus, labels: Labels) {
  return labels.companyStatuses[status] ?? status;
}

function formatSubscriptionStatus(status: SubscriptionStatus, labels: Labels) {
  return labels.subscriptionStatuses[status] ?? status;
}

function formatSwitchStatus(status: SwitchSessionStatus, labels: Labels) {
  return labels.switchStatuses[status] ?? status;
}

function formatBilling(interval: BillingInterval, labels: Labels) {
  return labels.billingIntervals[interval] ?? interval;
}

function formatDate(value: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatMoney(value: string | number, currency: string, lang: Lang) {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", { style: "currency", currency }).format(Number(value));
}

function formatBytes(value: number, lang: Lang) {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 1 }).format(value / 1024 / 1024) + " MB";
}

function numberFromForm(form: FormData, key: string) {
  const value = Number(form.get(key));
  return Number.isFinite(value) ? value : undefined;
}

function optionalNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function parseSettingValue(value: string, type: string) {
  if (type === "NUMBER") return Number(value);
  if (type === "BOOLEAN") return value === "true";
  if (type === "JSON") return parseJsonObject(value);
  return value;
}

type Labels = ReturnType<typeof platformLabels>;

function platformLabels(lang: Lang) {
  const ar = lang === "ar";
  return {
    loading: ar ? "جاري التحميل..." : "Loading...",
    error: ar ? "تعذر تحميل البيانات" : "Could not load data",
    empty: ar ? "لا توجد بيانات" : "No data",
    search: ar ? "بحث" : "Search",
    reset: ar ? "إعادة ضبط" : "Reset",
    save: ar ? "حفظ" : "Save",
    cancel: ar ? "إلغاء" : "Cancel",
    close: ar ? "إغلاق" : "Close",
    previous: ar ? "السابق" : "Previous",
    next: ar ? "التالي" : "Next",
    total: ar ? "الإجمالي" : "Total",
    yes: ar ? "نعم" : "Yes",
    no: ar ? "لا" : "No",
    view: ar ? "عرض" : "View",
    edit: ar ? "تعديل" : "Edit",
    actions: ar ? "الإجراءات" : "Actions",
    platformDashboard: ar ? "لوحة منصة SaaS" : "SaaS Platform Dashboard",
    platformDashboardDescription: ar ? "متابعة الشركات والاشتراكات واستخدام المنصة" : "Monitor companies, subscriptions, and platform usage.",
    companies: ar ? "الشركات" : "Companies",
    companiesDescription: ar ? "إدارة المستأجرين وحالة كل شركة" : "Manage tenants and company status.",
    subscriptions: ar ? "الاشتراكات" : "Subscriptions",
    subscriptionsDescription: ar ? "إدارة اشتراكات الشركات وخططها" : "Manage company subscriptions and plans.",
    plans: ar ? "الخطط" : "Plans",
    plansDescription: ar ? "إنشاء وإدارة خطط الاشتراك" : "Create and manage subscription plans.",
    analytics: ar ? "التحليلات" : "Analytics",
    analyticsDescription: ar ? "مؤشرات نمو واستخدام المنصة" : "Platform growth and usage metrics.",
    settings: ar ? "الإعدادات" : "Settings",
    settingsDescription: ar ? "إعدادات المنصة العامة" : "Platform-wide settings.",
    switchSessions: ar ? "جلسات التبديل" : "Switch Sessions",
    switchSessionsDescription: ar ? "إنشاء ومراجعة جلسات دعم الشركات" : "Create and review tenant support sessions.",
    totalCompanies: ar ? "إجمالي الشركات" : "Total Companies",
    activeCompanies: ar ? "شركات نشطة" : "Active Companies",
    suspendedCompanies: ar ? "شركات موقوفة" : "Suspended Companies",
    trialCompanies: ar ? "شركات تجريبية" : "Trial Companies",
    totalUsers: ar ? "إجمالي المستخدمين" : "Total Users",
    totalTasks: ar ? "إجمالي المهام" : "Total Tasks",
    totalLeaveRequests: ar ? "طلبات الإجازة" : "Leave Requests",
    totalEmails: ar ? "إجمالي البريد" : "Total Emails",
    subscriptionOverview: ar ? "نظرة الاشتراكات" : "Subscription Overview",
    topCompanies: ar ? "أعلى الشركات استخداماً" : "Top Companies",
    recentUsage: ar ? "الاستخدام الأخير" : "Recent Usage",
    companiesGrowth: ar ? "نمو الشركات" : "Companies Growth",
    usersGrowth: ar ? "نمو المستخدمين" : "Users Growth",
    tasksGrowth: ar ? "نمو المهام" : "Tasks Growth",
    emailGrowth: ar ? "نمو البريد" : "Email Growth",
    overview: ar ? "نظرة عامة" : "Overview",
    subscriptionDistribution: ar ? "توزيع الاشتراكات" : "Subscription Distribution",
    companyTable: ar ? "جدول الشركات" : "Company Table",
    company: ar ? "الشركة" : "Company",
    companyDetails: ar ? "تفاصيل الشركة" : "Company Details",
    companyDetailsDescription: ar ? "ملخص الاشتراك والإحصاءات" : "Subscription summary and statistics.",
    latestSubscription: ar ? "آخر اشتراك" : "Latest Subscription",
    statistics: ar ? "الإحصاءات" : "Statistics",
    plan: ar ? "الخطة" : "Plan",
    status: ar ? "الحالة" : "Status",
    users: ar ? "المستخدمون" : "Users",
    departments: ar ? "الأقسام" : "Departments",
    domain: ar ? "النطاق" : "Domain",
    billingEmail: ar ? "بريد الفوترة" : "Billing Email",
    updated: ar ? "آخر تحديث" : "Updated",
    storage: ar ? "التخزين" : "Storage",
    lastActivity: ar ? "آخر نشاط" : "Last Activity",
    suspend: ar ? "إيقاف" : "Suspend",
    activate: ar ? "تفعيل" : "Activate",
    suspendCompany: ar ? "إيقاف الشركة" : "Suspend Company",
    activateCompany: ar ? "تفعيل الشركة" : "Activate Company",
    confirmSuspend: ar ? "سيتم منع هذه الشركة من استخدام النظام." : "This company will be blocked from using the system.",
    confirmActivate: ar ? "سيتم السماح لهذه الشركة باستخدام النظام مجدداً." : "This company will be allowed to use the system again.",
    companySuspended: ar ? "تم إيقاف الشركة" : "Company suspended",
    companyActivated: ar ? "تم تفعيل الشركة" : "Company activated",
    createSubscription: ar ? "إنشاء اشتراك" : "Create Subscription",
    editSubscription: ar ? "تعديل الاشتراك" : "Edit Subscription",
    subscriptionCreated: ar ? "تم إنشاء الاشتراك" : "Subscription created",
    subscriptionUpdated: ar ? "تم تحديث الاشتراك" : "Subscription updated",
    seats: ar ? "المقاعد" : "Seats",
    billing: ar ? "الفوترة" : "Billing",
    trialEnd: ar ? "نهاية التجربة" : "Trial End",
    currentPeriodEnd: ar ? "نهاية الفترة" : "Current Period End",
    createPlan: ar ? "إنشاء خطة" : "Create Plan",
    planCreated: ar ? "تم إنشاء الخطة" : "Plan created",
    code: ar ? "الكود" : "Code",
    name: ar ? "الاسم" : "Name",
    tier: ar ? "المستوى" : "Tier",
    monthlyPrice: ar ? "السعر الشهري" : "Monthly Price",
    yearlyPrice: ar ? "السعر السنوي" : "Yearly Price",
    currency: ar ? "العملة" : "Currency",
    active: ar ? "نشط" : "Active",
    inactive: ar ? "غير نشط" : "Inactive",
    featuresJson: ar ? "ميزات JSON" : "Features JSON",
    limitsJson: ar ? "حدود JSON" : "Limits JSON",
    updateSetting: ar ? "تحديث إعداد" : "Update Setting",
    settingUpdated: ar ? "تم تحديث الإعداد" : "Setting updated",
    noSettings: ar ? "لا توجد إعدادات حالياً" : "No settings yet",
    key: ar ? "المفتاح" : "Key",
    type: ar ? "النوع" : "Type",
    value: ar ? "القيمة" : "Value",
    description: ar ? "الوصف" : "Description",
    secret: ar ? "سري" : "Secret",
    createSwitchSession: ar ? "إنشاء جلسة تبديل" : "Create Switch Session",
    switchSessionCreated: ar ? "تم إنشاء جلسة التبديل" : "Switch session created",
    switchSessionEnded: ar ? "تم إنهاء الجلسة" : "Switch session ended",
    actor: ar ? "المنفذ" : "Actor",
    started: ar ? "بدأت" : "Started",
    expires: ar ? "تنتهي" : "Expires",
    reason: ar ? "السبب" : "Reason",
    endSession: ar ? "إنهاء الجلسة" : "End Session",
    confirmEndSession: ar ? "سيتم إنهاء صلاحية رمز هذه الجلسة." : "This switch token will no longer be valid.",
    switchTokenCreated: ar ? "تم إنشاء رمز التبديل" : "Impersonation token created",
    copyToken: ar ? "نسخ الرمز" : "Copy Token",
    tokenCopied: ar ? "تم نسخ الرمز" : "Token copied",
    openCompany: ar ? "فتح الشركة" : "Open Company",
    permissionDenied: ar ? "غير مصرح" : "Permission denied",
    permissionDeniedDescription: ar ? "تحتاج إلى صلاحيات منصة للوصول إلى هذه الصفحة." : "You need platform permissions to access this page.",
    plansMap: {
      STARTER: ar ? "أساسية" : "Starter",
      PROFESSIONAL: ar ? "احترافية" : "Professional",
      ENTERPRISE: ar ? "مؤسسة" : "Enterprise"
    },
    companyStatuses: {
      ACTIVE: ar ? "نشطة" : "Active",
      TRIAL: ar ? "تجريبية" : "Trial",
      SUSPENDED: ar ? "موقوفة" : "Suspended"
    },
    subscriptionStatuses: {
      TRIALING: ar ? "تجريبي" : "Trialing",
      ACTIVE: ar ? "نشط" : "Active",
      PAST_DUE: ar ? "متأخر" : "Past Due",
      CANCELLED: ar ? "ملغى" : "Cancelled",
      EXPIRED: ar ? "منتهي" : "Expired"
    },
    billingIntervals: {
      MONTHLY: ar ? "شهري" : "Monthly",
      YEARLY: ar ? "سنوي" : "Yearly"
    },
    switchStatuses: {
      ACTIVE: ar ? "نشطة" : "Active",
      ENDED: ar ? "منتهية" : "Ended",
      REVOKED: ar ? "ملغاة" : "Revoked",
      EXPIRED: ar ? "منتهية الصلاحية" : "Expired"
    }
  };
}
