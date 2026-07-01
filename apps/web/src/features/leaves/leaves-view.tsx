"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CalendarDays, Check, Clock, HelpCircle, Hourglass, Plus, Search, Settings, Users, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useAuth } from "@/features/auth/auth-store";
import { Av } from "@/features/prototype/avatar";
import { StatusBadge } from "@/features/prototype/badges";
import { useUiText } from "@/features/prototype/use-ui-text";
import { formatDate } from "@/features/tasks/task-widgets";
import {
  CreateLeavePayload,
  LeaveApprovalMode,
  LeaveBalance,
  LeaveDurationType,
  LeaveFilters,
  LeaveRequest,
  LeaveStatus,
  leavesService,
  LeaveType
} from "./leaves-service";

const leaveQueryKeys = {
  lists: ["leaves"] as const,
  list: (filters: unknown) => ["leaves", "list", filters] as const,
  detail: (id: string | null) => ["leaves", "detail", id] as const,
  types: ["leaves", "types"] as const,
  users: ["leaves", "users"] as const,
  balances: (year: number | null) => ["leaves", "balances", year] as const,
  settings: ["leaves", "settings"] as const,
  calendar: (range: unknown) => ["leaves", "calendar", range] as const,
  availability: (range: unknown) => ["leaves", "availability", range] as const
};

const LEAVE_STATUSES: Array<{ value: LeaveStatus; ar: string; en: string }> = [
  { value: "PENDING", ar: "معلق", en: "Pending" },
  { value: "INFO_REQUESTED", ar: "بانتظار معلومات", en: "Info requested" },
  { value: "APPROVED", ar: "موافق عليه", en: "Approved" },
  { value: "REJECTED", ar: "مرفوض", en: "Rejected" },
  { value: "CANCELLED", ar: "ملغى", en: "Cancelled" }
];

const DURATION_TYPES: Array<{ value: LeaveDurationType; ar: string; en: string }> = [
  { value: "FULL_DAY", ar: "يوم كامل", en: "Full day" },
  { value: "HALF_DAY", ar: "نصف يوم", en: "Half day" },
  { value: "HOURS", ar: "استئذان ساعات", en: "Hourly permission" }
];

export function LeavesView() {
  const { t, lang } = useUiText();
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const context = useMemo(() => (accessToken && user ? { token: accessToken, companyId: user.companyId } : null), [accessToken, user]);
  const [filters, setFilters] = useState<LeaveFilters>({});
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [availabilityDate, setAvailabilityDate] = useState("");

  useEffect(() => {
    const today = new Date();
    setAvailabilityDate(toDateInput(today));
  }, []);

  const balanceYear = availabilityDate ? Number(availabilityDate.slice(0, 4)) : null;
  const calendarRange = useMemo(
    () => (availabilityDate ? monthRangeFromDate(availabilityDate, filters.departmentId) : null),
    [availabilityDate, filters.departmentId]
  );
  const availabilityRange = useMemo(
    () => (availabilityDate ? dayRangeFromDate(availabilityDate, filters.departmentId) : null),
    [availabilityDate, filters.departmentId]
  );

  const leavesQuery = useQuery({
    queryKey: leaveQueryKeys.list(filters),
    queryFn: () => leavesService.list(context!, filters),
    enabled: Boolean(context)
  });
  const typesQuery = useQuery({
    queryKey: leaveQueryKeys.types,
    queryFn: () => leavesService.types(context!),
    enabled: Boolean(context)
  });
  const usersQuery = useQuery({
    queryKey: leaveQueryKeys.users,
    queryFn: () => leavesService.users(context!),
    enabled: Boolean(context)
  });
  const balancesQuery = useQuery({
    queryKey: leaveQueryKeys.balances(balanceYear),
    queryFn: () => leavesService.balances(context!, { year: balanceYear ?? undefined }),
    enabled: Boolean(context && balanceYear)
  });
  const settingsQuery = useQuery({
    queryKey: leaveQueryKeys.settings,
    queryFn: () => leavesService.settings(context!),
    enabled: Boolean(context)
  });
  const calendarQuery = useQuery({
    queryKey: leaveQueryKeys.calendar(calendarRange),
    queryFn: () => leavesService.calendar(context!, calendarRange!),
    enabled: Boolean(context && calendarRange)
  });
  const availabilityQuery = useQuery({
    queryKey: leaveQueryKeys.availability(availabilityRange),
    queryFn: () => leavesService.availability(context!, availabilityRange!),
    enabled: Boolean(context && availabilityRange)
  });

  function refreshLeaveQueries() {
    void queryClient.invalidateQueries({ queryKey: leaveQueryKeys.lists });
    void queryClient.invalidateQueries({ queryKey: leaveQueryKeys.balances(balanceYear) });
    void queryClient.invalidateQueries({ queryKey: leaveQueryKeys.calendar(calendarRange) });
    void queryClient.invalidateQueries({ queryKey: leaveQueryKeys.availability(availabilityRange) });
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateLeavePayload) => leavesService.create(context!, payload),
    onSuccess: (leave) => {
      setFormOpen(false);
      setSelectedId(leave.id);
      refreshLeaveQueries();
    }
  });
  const approveMutation = useMutation({
    mutationFn: (id: string) => leavesService.approve(context!, id),
    onSuccess: (leave) => {
      refreshLeaveQueries();
      void queryClient.invalidateQueries({ queryKey: leaveQueryKeys.detail(leave.id) });
    }
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => leavesService.reject(context!, id),
    onSuccess: (leave) => {
      refreshLeaveQueries();
      void queryClient.invalidateQueries({ queryKey: leaveQueryKeys.detail(leave.id) });
    }
  });
  const cancelMutation = useMutation({
    mutationFn: (id: string) => leavesService.cancel(context!, id),
    onSuccess: (leave) => {
      refreshLeaveQueries();
      void queryClient.invalidateQueries({ queryKey: leaveQueryKeys.detail(leave.id) });
    }
  });
  const requestInfoMutation = useMutation({
    mutationFn: (id: string) => leavesService.requestInfo(context!, id, lang === "ar" ? "يرجى إضافة معلومات إضافية." : "Please add more information."),
    onSuccess: (leave) => {
      refreshLeaveQueries();
      void queryClient.invalidateQueries({ queryKey: leaveQueryKeys.detail(leave.id) });
    }
  });
  const settingsMutation = useMutation({
    mutationFn: (approvalMode: LeaveApprovalMode) => leavesService.updateSettings(context!, approvalMode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leaveQueryKeys.settings });
    }
  });

  const leaves = leavesQuery.data ?? [];
  const balances = balancesQuery.data ?? [];
  const calendarItems = calendarQuery.data ?? [];
  const availability = availabilityQuery.data;
  const departments = uniqueDepartments(usersQuery.data ?? []);
  const canManageLeaveSettings = Boolean(user?.permissions.includes("leave_settings:write"));

  if (!context) {
    return <ErrorState label={lang === "ar" ? "سجّل الدخول لعرض طلبات الإجازة" : "Sign in to view leave requests"} />;
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.leaves}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {leaves.length} {t.requests}
          </p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          {t.requestLeave}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        <MetricCard
          icon={<Hourglass className="w-4 h-4" />}
          label={lang === "ar" ? "طلبات بانتظار الموافقة" : "Pending approvals"}
          value={String(leaves.filter((leave) => leave.status === "PENDING").length)}
        />
        <MetricCard
          icon={<CalendarDays className="w-4 h-4" />}
          label={lang === "ar" ? "إجازات هذا الشهر" : "This month on leave"}
          value={String(calendarItems.length)}
        />
        <MetricCard
          icon={<Users className="w-4 h-4" />}
          label={lang === "ar" ? "المتاحون اليوم" : "Available today"}
          value={availability ? `${availability.availableCount}/${availability.totalEmployees}` : "-"}
        />
        <MetricCard
          icon={<Clock className="w-4 h-4" />}
          label={lang === "ar" ? "الرصيد السنوي المتبقي" : "Remaining annual leave"}
          value={formatBalance(primaryAnnualBalance(balances))}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 mb-5">
        <BalanceSummary lang={lang} balances={balances} loading={balancesQuery.isLoading} />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
          <AvailabilityPanel
            lang={lang}
            date={availabilityDate}
            onDateChange={setAvailabilityDate}
            availability={availability}
            loading={availabilityQuery.isLoading}
          />
          <LeaveSettingsPanel
            lang={lang}
            mode={settingsQuery.data?.approvalMode}
            pending={settingsMutation.isPending}
            editable={canManageLeaveSettings}
            onChange={(mode) => settingsMutation.mutate(mode)}
          />
        </div>
      </div>

      <CalendarPreview lang={lang} leaves={calendarItems} loading={calendarQuery.isLoading} />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-5">
        <label className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute top-1/2 -translate-y-1/2 start-3" />
          <input
            value={filters.search ?? ""}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder={t.search}
            className="w-full rounded-xl border border-border bg-card ps-9 pe-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <select
          value={filters.status ?? ""}
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as LeaveStatus | "" }))}
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">{t.status}</option>
          {LEAVE_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {lang === "ar" ? status.ar : status.en}
            </option>
          ))}
        </select>
        <select
          value={filters.leaveTypeId ?? ""}
          onChange={(event) => setFilters((current) => ({ ...current, leaveTypeId: event.target.value }))}
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">{t.leaveType}</option>
          {(typesQuery.data ?? []).map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
        <select
          value={filters.departmentId ?? ""}
          onChange={(event) => setFilters((current) => ({ ...current, departmentId: event.target.value }))}
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">{lang === "ar" ? "القسم" : "Department"}</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <select
          value={filters.employeeId ?? ""}
          onChange={(event) => setFilters((current) => ({ ...current, employeeId: event.target.value }))}
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">{t.employees}</option>
          {(usersQuery.data ?? []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>

      {leavesQuery.isLoading && <LoadingState label={t.loading} />}
      {leavesQuery.isError && <ErrorState label={t.error} />}
      {!leavesQuery.isLoading && !leavesQuery.isError && !leaves.length && <EmptyState label={t.empty} />}

      <div className="space-y-3">
        {leaves.map((leave) => (
          <div key={leave.id} onClick={() => setSelectedId(leave.id)} className="bg-card rounded-2xl border border-border p-4 flex flex-col md:flex-row md:items-center gap-4 hover:shadow-sm transition-shadow cursor-pointer">
            <Av letter={leave.employee.name[0] ?? "?"} color="bg-emerald-500" size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="font-semibold text-foreground text-sm">{leave.employee.name}</span>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{leave.leaveType}</span>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(leave.startsAt, lang)} - {formatDate(leave.endsAt, lang)}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(leave, lang)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0" onClick={(event) => event.stopPropagation()}>
              <StatusBadge status={leave.status.toLowerCase()} lang={lang} />
              {leave.status === "PENDING" && (
                <>
                  <button
                    onClick={() => approveMutation.mutate(leave.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-lg text-xs font-semibold hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors"
                  >
                    <Check className="w-3 h-3" />
                    {t.approve}
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(leave.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    {t.reject}
                  </button>
                  <button
                    onClick={() => requestInfoMutation.mutate(leave.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-semibold hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
                  >
                    <HelpCircle className="w-3 h-3" />
                    {lang === "ar" ? "معلومات" : "Info"}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <LeaveRequestModal
        lang={lang}
        open={formOpen}
        types={typesQuery.data ?? []}
        employees={usersQuery.data ?? []}
        submitting={createMutation.isPending}
        onClose={() => setFormOpen(false)}
        onSubmit={(payload) => createMutation.mutate(payload)}
      />
      <LeaveDetailPanel
        lang={lang}
        context={context}
        id={selectedId}
        onClose={() => setSelectedId(null)}
        onCancel={(id) => cancelMutation.mutate(id)}
      />
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border px-4 py-3 min-w-0">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs font-semibold truncate">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function BalanceSummary({ lang, balances, loading }: { lang: "ar" | "en"; balances: LeaveBalance[]; loading: boolean }) {
  return (
    <section className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-bold text-foreground">{lang === "ar" ? "أرصدة الإجازات" : "Leave balances"}</h2>
        <span className="text-xs font-semibold text-muted-foreground">{balances[0]?.year ?? ""}</span>
      </div>
      {loading && <p className="text-sm text-muted-foreground">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</p>}
      {!loading && !balances.length && <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا توجد أرصدة بعد" : "No balances yet"}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {balances.slice(0, 6).map((balance) => (
          <div key={balance.id} className="rounded-xl bg-muted/50 px-3 py-3 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-bold text-foreground truncate">{balance.leaveType.name}</p>
              <span className="text-xs font-semibold text-muted-foreground">{balance.leaveType.code}</span>
            </div>
            <div className="h-2 rounded-full bg-background overflow-hidden mb-2">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.min(100, Math.max(0, (Number(balance.usedDays) / Math.max(1, Number(balance.allocatedDays))) * 100))}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatBalance(balance)} {lang === "ar" ? "متبقي من" : "remaining of"} {formatDecimal(balance.allocatedDays)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AvailabilityPanel({
  lang,
  date,
  onDateChange,
  availability,
  loading
}: {
  lang: "ar" | "en";
  date: string;
  onDateChange: (date: string) => void;
  availability?: { totalEmployees: number; onLeaveCount: number; availableCount: number; onLeave: LeaveRequest[] };
  loading: boolean;
}) {
  return (
    <section className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-bold text-foreground">{lang === "ar" ? "توفر الفريق" : "Team availability"}</h2>
        <input
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label={lang === "ar" ? "الإجمالي" : "Total"} value={String(availability?.totalEmployees ?? 0)} />
          <MiniStat label={lang === "ar" ? "في إجازة" : "On leave"} value={String(availability?.onLeaveCount ?? 0)} />
          <MiniStat label={lang === "ar" ? "متاح" : "Available"} value={String(availability?.availableCount ?? 0)} />
        </div>
      )}
    </section>
  );
}

function LeaveSettingsPanel({
  lang,
  mode,
  pending,
  editable,
  onChange
}: {
  lang: "ar" | "en";
  mode?: LeaveApprovalMode;
  pending: boolean;
  editable: boolean;
  onChange: (mode: LeaveApprovalMode) => void;
}) {
  return (
    <section className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-bold text-foreground">{lang === "ar" ? "مسار الموافقة" : "Approval workflow"}</h2>
      </div>
      <select
        value={mode ?? "MANAGER_HR"}
        disabled={pending || !editable}
        onChange={(event) => onChange(event.target.value as LeaveApprovalMode)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
      >
        <option value="MANAGER_HR">{lang === "ar" ? "المدير ثم الموارد البشرية" : "Manager then HR"}</option>
        <option value="MANAGER_ONLY">{lang === "ar" ? "المدير فقط" : "Manager only"}</option>
      </select>
    </section>
  );
}

function CalendarPreview({ lang, leaves, loading }: { lang: "ar" | "en"; leaves: LeaveRequest[]; loading: boolean }) {
  return (
    <section className="bg-card rounded-2xl border border-border p-4 mb-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-bold text-foreground">{lang === "ar" ? "تقويم الإجازات" : "Leave calendar"}</h2>
        <span className="text-xs font-semibold text-muted-foreground">{leaves.length}</span>
      </div>
      {loading && <p className="text-sm text-muted-foreground">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</p>}
      {!loading && !leaves.length && <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا توجد إجازات معتمدة في هذا النطاق" : "No approved leave in this range"}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {leaves.slice(0, 6).map((leave) => (
          <div key={leave.id} className="rounded-xl bg-muted/50 px-3 py-2.5 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{leave.employee.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {leave.leaveType} · {formatDate(leave.startsAt, lang)} - {formatDate(leave.endsAt, lang)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2.5 min-w-0">
      <p className="text-xs font-semibold text-muted-foreground truncate">{label}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function primaryAnnualBalance(balances: LeaveBalance[]) {
  return balances.find((balance) => balance.leaveType.code === "ANNUAL") ?? balances[0];
}

function formatBalance(balance?: LeaveBalance) {
  return balance ? formatDecimal(balance.remainingDays) : "-";
}

function formatDuration(leave: LeaveRequest, lang: "ar" | "en") {
  if (leave.durationType === "HOURS") {
    return `${formatDecimal(leave.durationHours ?? 0)} ${lang === "ar" ? "ساعات" : "hours"}`;
  }

  if (leave.durationType === "HALF_DAY") {
    const period =
      leave.halfDayPeriod === "AFTERNOON"
        ? lang === "ar"
          ? "مساءً"
          : "afternoon"
        : lang === "ar"
          ? "صباحاً"
          : "morning";
    return `${lang === "ar" ? "نصف يوم" : "Half day"} · ${period}`;
  }

  return `${formatDecimal(leave.durationDays)} ${lang === "ar" ? "أيام" : "days"}`;
}

function formatDecimal(value: string | number) {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function uniqueDepartments(users: Array<{ department?: { id: string; name: string; code: string } | null }>) {
  const departments = new Map<string, { id: string; name: string; code: string }>();

  for (const user of users) {
    if (user.department) {
      departments.set(user.department.id, user.department);
    }
  }

  return [...departments.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dayRangeFromDate(date: string, departmentId?: string) {
  return {
    from: `${date}T00:00:00.000Z`,
    to: `${date}T23:59:59.999Z`,
    departmentId: departmentId || undefined
  };
}

function monthRangeFromDate(date: string, departmentId?: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const start = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
  const end = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  return {
    from: start.toISOString(),
    to: end.toISOString(),
    departmentId: departmentId || undefined
  };
}

function LeaveRequestModal({
  lang,
  open,
  types,
  employees,
  submitting,
  onClose,
  onSubmit
}: {
  lang: "ar" | "en";
  open: boolean;
  types: LeaveType[];
  employees: Array<{ id: string; name: string }>;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateLeavePayload) => void;
}) {
  const [payload, setPayload] = useState<CreateLeavePayload>({ leaveTypeId: "", startsAt: "", endsAt: "", durationType: "FULL_DAY", reason: "" });

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            ...payload,
            startsAt: new Date(payload.startsAt).toISOString(),
            endsAt: new Date(payload.endsAt).toISOString(),
            employeeId: payload.employeeId || undefined,
            durationType: payload.durationType ?? "FULL_DAY",
            durationHours: payload.durationType === "HOURS" ? Number(payload.durationHours ?? 1) : undefined,
            halfDayPeriod: payload.durationType === "HALF_DAY" ? payload.halfDayPeriod ?? "MORNING" : undefined,
            reason: payload.reason || undefined
          });
        }}
        className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">{lang === "ar" ? "طلب إجازة" : "Request leave"}</h2>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="md:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "نوع الإجازة" : "Leave type"}</span>
            <select
              required
              value={payload.leaveTypeId}
              onChange={(event) => setPayload((current) => ({ ...current, leaveTypeId: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{lang === "ar" ? "اختر النوع" : "Select type"}</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "الموظف" : "Employee"}</span>
            <select
              value={payload.employeeId ?? ""}
              onChange={(event) => setPayload((current) => ({ ...current, employeeId: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{lang === "ar" ? "أنا" : "Me"}</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "تاريخ البدء" : "Start date"}</span>
            <input
              required
              type="date"
              value={payload.startsAt}
              onChange={(event) => setPayload((current) => ({ ...current, startsAt: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label>
            <span className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "تاريخ الانتهاء" : "End date"}</span>
            <input
              required
              type="date"
              value={payload.endsAt}
              onChange={(event) => setPayload((current) => ({ ...current, endsAt: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label>
            <span className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "المدة" : "Duration"}</span>
            <select
              value={payload.durationType ?? "FULL_DAY"}
              onChange={(event) =>
                setPayload((current) => ({
                  ...current,
                  durationType: event.target.value as LeaveDurationType,
                  durationHours: event.target.value === "HOURS" ? current.durationHours ?? 2 : undefined,
                  halfDayPeriod: event.target.value === "HALF_DAY" ? current.halfDayPeriod ?? "MORNING" : undefined
                }))
              }
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              {DURATION_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {lang === "ar" ? option.ar : option.en}
                </option>
              ))}
            </select>
          </label>
          {payload.durationType === "HALF_DAY" && (
            <label>
              <span className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "الفترة" : "Period"}</span>
              <select
                value={payload.halfDayPeriod ?? "MORNING"}
                onChange={(event) => setPayload((current) => ({ ...current, halfDayPeriod: event.target.value as "MORNING" | "AFTERNOON" }))}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="MORNING">{lang === "ar" ? "صباحاً" : "Morning"}</option>
                <option value="AFTERNOON">{lang === "ar" ? "مساءً" : "Afternoon"}</option>
              </select>
            </label>
          )}
          {payload.durationType === "HOURS" && (
            <label>
              <span className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "عدد الساعات" : "Hours"}</span>
              <input
                required
                type="number"
                min={1}
                max={8}
                step={0.5}
                value={payload.durationHours ?? 2}
                onChange={(event) => setPayload((current) => ({ ...current, durationHours: Number(event.target.value) }))}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
          )}
          <label className="md:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "السبب" : "Reason"}</span>
            <textarea
              value={payload.reason ?? ""}
              onChange={(event) => setPayload((current) => ({ ...current, reason: event.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </label>
        </div>
        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm font-semibold hover:text-foreground transition-colors">
            {lang === "ar" ? "إلغاء" : "Cancel"}
          </button>
          <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {submitting ? (lang === "ar" ? "جاري الإرسال..." : "Submitting...") : lang === "ar" ? "إرسال" : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}

function LeaveDetailPanel({
  lang,
  context,
  id,
  onClose,
  onCancel
}: {
  lang: "ar" | "en";
  context: { token: string; companyId: string } | null;
  id: string | null;
  onClose: () => void;
  onCancel: (id: string) => void;
}) {
  const detailQuery = useQuery({
    queryKey: leaveQueryKeys.detail(id),
    queryFn: () => leavesService.get(context!, id!),
    enabled: Boolean(context && id)
  });

  if (!id) {
    return null;
  }

  const leave = detailQuery.data;

  return (
    <div className="fixed inset-0 z-40 bg-black/35 flex justify-end">
      <aside className="w-full max-w-xl h-full bg-card border-s border-border shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">{leave?.leaveType ?? ""}</p>
            <h2 className="text-lg font-bold text-foreground line-clamp-1">{leave?.employee.name ?? (lang === "ar" ? "تفاصيل الإجازة" : "Leave details")}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {detailQuery.isLoading && <LoadingState label={lang === "ar" ? "جاري التحميل..." : "Loading..."} />}
        {detailQuery.isError && <ErrorState label={lang === "ar" ? "تعذر تحميل الطلب" : "Could not load request"} />}
        {leave && (
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <StatusBadge status={leave.status.toLowerCase()} lang={lang} />
              {leave.status === "PENDING" && (
                <button onClick={() => onCancel(leave.id)} className="px-3 py-2 rounded-xl bg-muted text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  {lang === "ar" ? "إلغاء الطلب" : "Cancel request"}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Info label={lang === "ar" ? "البداية" : "Start"} value={formatDate(leave.startsAt, lang)} />
              <Info label={lang === "ar" ? "النهاية" : "End"} value={formatDate(leave.endsAt, lang)} />
              <Info label={lang === "ar" ? "المدة" : "Duration"} value={formatDuration(leave, lang)} />
              <Info label={lang === "ar" ? "القسم" : "Department"} value={leave.department?.name ?? "-"} />
              {leave.infoRequestedAt && <Info label={lang === "ar" ? "طلب معلومات" : "Info requested"} value={formatDate(leave.infoRequestedAt, lang)} />}
            </div>
            <section>
              <h3 className="text-sm font-bold text-foreground mb-2">{lang === "ar" ? "السبب" : "Reason"}</h3>
              <p className="text-sm text-muted-foreground leading-6">{leave.reason || "-"}</p>
            </section>
            <section>
              <h3 className="text-sm font-bold text-foreground mb-2">{lang === "ar" ? "مسار الموافقات" : "Approval path"}</h3>
              <div className="space-y-2">
                {(leave.approvalActions ?? []).map((action) => (
                  <div key={action.id} className="rounded-xl bg-muted/50 px-3 py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{action.step?.name ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">{action.step?.approverRole?.name ?? action.actor?.name ?? "-"}</p>
                    </div>
                    <StatusBadge status={action.status.toLowerCase()} lang={lang} />
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h3 className="text-sm font-bold text-foreground mb-2">{lang === "ar" ? "سجل النشاط" : "Activity timeline"}</h3>
              <div className="space-y-2">
                {(leave.activities ?? []).map((activity) => (
                  <div key={activity.id} className="border-s-2 border-primary/30 ps-3 py-1">
                    <p className="text-sm font-medium text-foreground">{lang === "ar" ? activity.titleAr || activity.title : activity.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(activity.createdAt, lang)}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2.5 min-w-0">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-1 truncate">{value}</p>
    </div>
  );
}
