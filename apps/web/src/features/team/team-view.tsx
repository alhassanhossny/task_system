"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, Check, ClipboardCheck, Clock, Filter, ListChecks, Search, UserCheck, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useAuth } from "@/features/auth/auth-store";
import type { LeaveRequest, LeaveStatus } from "@/features/leaves/leaves-service";
import { PriorityBadge, StatusBadge } from "@/features/prototype/badges";
import { useUiText } from "@/features/prototype/use-ui-text";
import type { Task, TaskPriority, TaskStatus } from "@/features/tasks/tasks-service";
import { teamService, type TeamLeaveFilters, type TeamTaskFilters } from "./team-service";

type TeamTab = "overview" | "members" | "leaves" | "availability" | "tasks";

const LEAVE_STATUSES: LeaveStatus[] = ["PENDING", "INFO_REQUESTED", "APPROVED", "REJECTED", "CANCELLED"];
const TASK_STATUSES: TaskStatus[] = ["NEW", "ASSIGNED", "IN_PROGRESS", "PENDING", "COMPLETED", "CANCELLED"];
const TASK_PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function TeamView() {
  const { t, lang } = useUiText();
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const context = useMemo(() => (accessToken && user ? { token: accessToken, companyId: user.companyId } : null), [accessToken, user]);
  const [tab, setTab] = useState<TeamTab>("overview");
  const [today, setToday] = useState("");
  const [leaveFilters, setLeaveFilters] = useState<TeamLeaveFilters>({});
  const [taskFilters, setTaskFilters] = useState<TeamTaskFilters>({});

  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  const referenceDate = today ? `${today}T12:00:00.000Z` : undefined;
  const year = today ? Number(today.slice(0, 4)) : new Date().getFullYear();
  const dashboardQuery = useQuery({
    queryKey: ["team", "dashboard"],
    queryFn: () => teamService.dashboard(context!),
    enabled: Boolean(context)
  });
  const membersQuery = useQuery({
    queryKey: ["team", "members"],
    queryFn: () => teamService.members(context!),
    enabled: Boolean(context)
  });
  const availabilityQuery = useQuery({
    queryKey: ["team", "availability", referenceDate],
    queryFn: () => teamService.availability(context!, { referenceDate }),
    enabled: Boolean(context && referenceDate)
  });
  const balancesQuery = useQuery({
    queryKey: ["team", "leave-balances", year],
    queryFn: () => teamService.leaveBalances(context!, { year }),
    enabled: Boolean(context)
  });
  const leavesQuery = useQuery({
    queryKey: ["team", "leave-requests", leaveFilters],
    queryFn: () => teamService.leaveRequests(context!, leaveFilters),
    enabled: Boolean(context)
  });
  const tasksQuery = useQuery({
    queryKey: ["team", "tasks", taskFilters],
    queryFn: () => teamService.tasks(context!, taskFilters),
    enabled: Boolean(context)
  });
  const overdueTasksQuery = useQuery({
    queryKey: ["team", "tasks", "overdue"],
    queryFn: () => teamService.overdueTasks(context!),
    enabled: Boolean(context)
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => teamService.approveLeave(context!, id),
    onSuccess: () => invalidateTeamQueries()
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => teamService.rejectLeave(context!, id),
    onSuccess: () => invalidateTeamQueries()
  });

  function invalidateTeamQueries() {
    void queryClient.invalidateQueries({ queryKey: ["team"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  if (!context) {
    return <ErrorState label={lang === "ar" ? "سجّل الدخول لعرض الفريق" : "Sign in to view your team"} />;
  }

  const dashboard = dashboardQuery.data;
  const members = membersQuery.data ?? [];
  const leaves = leavesQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const balances = balancesQuery.data ?? [];
  const awayToday = availabilityQuery.data?.today.onLeave ?? dashboard?.awayToday ?? [];
  const upcomingAbsences = availabilityQuery.data?.thisMonth.onLeave ?? dashboard?.upcomingAbsences ?? [];
  const openTasks = dashboard?.openTeamTasks ?? tasks.filter((task) => task.status !== "COMPLETED" && task.status !== "CANCELLED");
  const overdueTasks = overdueTasksQuery.data ?? dashboard?.overdueTeamTasks ?? [];
  const tabs: Array<{ id: TeamTab; label: string; icon: typeof Users }> = [
    { id: "overview", label: l(lang, "نظرة عامة", "Overview"), icon: ListChecks },
    { id: "members", label: l(lang, "الأعضاء", "Members"), icon: Users },
    { id: "leaves", label: l(lang, "طلبات الإجازة", "Leave Requests"), icon: ClipboardCheck },
    { id: "availability", label: l(lang, "التوفر", "Availability"), icon: CalendarDays },
    { id: "tasks", label: l(lang, "المهام", "Tasks"), icon: UserCheck }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.team}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {members.length} {l(lang, "عضو مباشر", "direct reports")}
          </p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`h-10 px-3 rounded-xl text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition-colors ${
                  tab === item.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
            <MetricCard icon={ClipboardCheck} label={l(lang, "موافقات معلقة", "Pending Approvals")} value={dashboard?.counts.pendingApprovals ?? leaves.filter((item) => item.status === "PENDING").length} tone="amber" />
            <MetricCard icon={Users} label={l(lang, "خارج العمل اليوم", "Away Today")} value={dashboard?.counts.awayToday ?? awayToday.length} tone="blue" />
            <MetricCard icon={CalendarDays} label={l(lang, "إجازات قادمة", "Upcoming Leave")} value={dashboard?.counts.upcomingAbsences ?? upcomingAbsences.length} tone="purple" />
            <MetricCard icon={ListChecks} label={l(lang, "مهام مفتوحة", "Open Tasks")} value={dashboard?.counts.openTeamTasks ?? openTasks.length} tone="green" />
            <MetricCard icon={AlertTriangle} label={l(lang, "مهام متأخرة", "Overdue Tasks")} value={dashboard?.counts.overdueTeamTasks ?? overdueTasks.length} tone="red" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Panel title={l(lang, "طلبات تحتاج قرار", "Pending Approvals")}>
              <LeaveList
                items={dashboard?.pendingApprovals ?? leaves.filter((item) => item.status === "PENDING")}
                lang={lang}
                emptyLabel={l(lang, "لا توجد طلبات معلقة", "No pending approvals")}
                onApprove={(id) => approveMutation.mutate(id)}
                onReject={(id) => rejectMutation.mutate(id)}
                busy={approveMutation.isPending || rejectMutation.isPending}
              />
            </Panel>
            <Panel title={l(lang, "أرصدة الفريق", "Team Leave Balances")}>
              <BalanceList balances={balances} lang={lang} />
            </Panel>
          </div>
        </div>
      )}

      {tab === "members" && (
        <Panel title={l(lang, "الأعضاء المباشرون", "Direct Reports")}>
          {membersQuery.isLoading && <LoadingState label={t.loading} />}
          {membersQuery.isError && <ErrorState label={t.error} />}
          {!membersQuery.isLoading && !membersQuery.isError && !members.length && <EmptyState label={l(lang, "لا يوجد أعضاء فريق", "No team members")} />}
          {!!members.length && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {members.map((member) => (
                <div key={member.id} className="border border-border rounded-2xl p-4 bg-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{member.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    <StatusBadge status={member.status.toLowerCase()} lang={lang} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <Info label={l(lang, "القسم", "Department")} value={member.department?.name ?? "-"} />
                    <Info label={l(lang, "المسمى", "Title")} value={member.jobTitle ?? "-"} />
                    <Info label={l(lang, "المهام", "Tasks")} value={String(member._count?.assignedTasks ?? 0)} />
                    <Info label={l(lang, "طلبات الإجازة", "Leave Requests")} value={String(member._count?.leaveRequests ?? 0)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === "leaves" && (
        <div className="space-y-4">
          <FilterBar>
            <label className="relative md:col-span-2">
              <Search className="w-4 h-4 text-muted-foreground absolute top-1/2 -translate-y-1/2 start-3" />
              <input
                value={leaveFilters.search ?? ""}
                onChange={(event) => setLeaveFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder={t.globalSearch}
                className="w-full rounded-xl border border-border bg-card ps-9 pe-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <select
              value={leaveFilters.status ?? ""}
              onChange={(event) => setLeaveFilters((current) => ({ ...current, status: event.target.value as LeaveStatus | "" }))}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{l(lang, "كل الحالات", "All statuses")}</option>
              {LEAVE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {leaveStatusLabel(lang, status)}
                </option>
              ))}
            </select>
            <select
              value={leaveFilters.employeeId ?? ""}
              onChange={(event) => setLeaveFilters((current) => ({ ...current, employeeId: event.target.value }))}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{l(lang, "كل الموظفين", "All employees")}</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Filter className="w-4 h-4" />
              <input
                type="date"
                value={leaveFilters.startsFrom ?? ""}
                onChange={(event) => setLeaveFilters((current) => ({ ...current, startsFrom: event.target.value }))}
                className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2 py-2 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </FilterBar>

          <Panel title={l(lang, "طلبات إجازات الفريق", "Team Leave Requests")}>
            {leavesQuery.isLoading && <LoadingState label={t.loading} />}
            {leavesQuery.isError && <ErrorState label={t.error} />}
            {!leavesQuery.isLoading && !leavesQuery.isError && <LeaveList items={leaves} lang={lang} emptyLabel={l(lang, "لا توجد طلبات", "No requests")} onApprove={(id) => approveMutation.mutate(id)} onReject={(id) => rejectMutation.mutate(id)} busy={approveMutation.isPending || rejectMutation.isPending} />}
          </Panel>
        </div>
      )}

      {tab === "availability" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <AvailabilityPanel title={l(lang, "اليوم", "Today")} window={availabilityQuery.data?.today} lang={lang} loading={availabilityQuery.isLoading} />
          <AvailabilityPanel title={l(lang, "هذا الأسبوع", "This Week")} window={availabilityQuery.data?.thisWeek} lang={lang} loading={availabilityQuery.isLoading} />
          <AvailabilityPanel title={l(lang, "هذا الشهر", "This Month")} window={availabilityQuery.data?.thisMonth} lang={lang} loading={availabilityQuery.isLoading} />
        </div>
      )}

      {tab === "tasks" && (
        <div className="space-y-4">
          <FilterBar>
            <label className="relative md:col-span-2">
              <Search className="w-4 h-4 text-muted-foreground absolute top-1/2 -translate-y-1/2 start-3" />
              <input
                value={taskFilters.search ?? ""}
                onChange={(event) => setTaskFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder={t.globalSearch}
                className="w-full rounded-xl border border-border bg-card ps-9 pe-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <select
              value={taskFilters.status ?? ""}
              onChange={(event) => setTaskFilters((current) => ({ ...current, status: event.target.value as TaskStatus | "" }))}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{l(lang, "كل الحالات", "All statuses")}</option>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {taskStatusLabel(lang, status)}
                </option>
              ))}
            </select>
            <select
              value={taskFilters.priority ?? ""}
              onChange={(event) => setTaskFilters((current) => ({ ...current, priority: event.target.value as TaskPriority | "" }))}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{l(lang, "كل الأولويات", "All priorities")}</option>
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabel(lang, priority)}
                </option>
              ))}
            </select>
            <select
              value={taskFilters.employeeId ?? ""}
              onChange={(event) => setTaskFilters((current) => ({ ...current, employeeId: event.target.value }))}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{l(lang, "كل الموظفين", "All employees")}</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </FilterBar>

          <Panel title={l(lang, "مهام الفريق", "Team Tasks")}>
            {tasksQuery.isLoading && <LoadingState label={t.loading} />}
            {tasksQuery.isError && <ErrorState label={t.error} />}
            {!tasksQuery.isLoading && !tasksQuery.isError && <TaskList items={tasks} lang={lang} emptyLabel={l(lang, "لا توجد مهام", "No tasks")} />}
          </Panel>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: number; tone: "amber" | "blue" | "purple" | "green" | "red" }) {
  const tones = {
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-300",
    green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-300",
    red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300"
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${tones[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-3xl font-bold text-foreground">{value}</div>
      <div className="text-sm font-medium text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-2xl border border-border p-5">
      <h2 className="text-sm font-semibold text-foreground mb-4">{title}</h2>
      {children}
    </section>
  );
}

function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-5 gap-2">{children}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold text-foreground truncate">{value}</div>
    </div>
  );
}

function LeaveList({
  items,
  lang,
  emptyLabel,
  onApprove,
  onReject,
  busy
}: {
  items: LeaveRequest[];
  lang: "ar" | "en";
  emptyLabel: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  busy: boolean;
}) {
  if (!items.length) {
    return <EmptyState label={emptyLabel} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {[l(lang, "الرقم", "Number"), l(lang, "الموظف", "Employee"), l(lang, "النوع", "Type"), l(lang, "الفترة", "Period"), l(lang, "الحالة", "Status"), ""].map((header) => (
              <th key={header} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border/60 last:border-0">
              <td className="px-4 py-3 text-xs font-bold text-muted-foreground whitespace-nowrap">{item.requestNumber ?? "-"}</td>
              <td className="px-4 py-3">
                <div className="font-semibold text-foreground whitespace-nowrap">{item.employee.name}</div>
                <div className="text-xs text-muted-foreground">{item.department?.name ?? "-"}</div>
              </td>
              <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">{item.leaveType}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                {formatDate(item.startsAt)} - {formatDate(item.endsAt)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={item.status.toLowerCase()} lang={lang} />
              </td>
              <td className="px-4 py-3">
                {item.status === "PENDING" && (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      disabled={busy}
                      onClick={() => onApprove(item.id)}
                      className="h-8 w-8 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-60 dark:bg-green-900/20 dark:text-green-300"
                      aria-label={l(lang, "موافقة", "Approve")}
                    >
                      <Check className="w-4 h-4 mx-auto" />
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => onReject(item.id)}
                      className="h-8 w-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60 dark:bg-red-900/20 dark:text-red-300"
                      aria-label={l(lang, "رفض", "Reject")}
                    >
                      <X className="w-4 h-4 mx-auto" />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BalanceList({ balances, lang }: { balances: Array<{ id: string; allocatedDays: string | number; usedDays: string | number; remainingDays: string | number; employee: { name: string }; leaveType: { name: string; code: string } }>; lang: "ar" | "en" }) {
  if (!balances.length) {
    return <EmptyState label={l(lang, "لا توجد أرصدة", "No balances")} />;
  }

  return (
    <div className="space-y-3">
      {balances.slice(0, 6).map((balance) => (
        <div key={balance.id} className="flex items-center justify-between gap-3 border-b border-border/60 last:border-0 pb-3 last:pb-0">
          <div className="min-w-0">
            <div className="font-semibold text-sm text-foreground truncate">{balance.employee.name}</div>
            <div className="text-xs text-muted-foreground truncate">{balance.leaveType.name}</div>
          </div>
          <div className="text-end">
            <div className="font-bold text-foreground">{formatDecimal(balance.remainingDays)}</div>
            <div className="text-xs text-muted-foreground">
              {formatDecimal(balance.usedDays)} / {formatDecimal(balance.allocatedDays)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AvailabilityPanel({ title, window, lang, loading }: { title: string; window?: { onLeaveCount: number; availableCount: number; onLeave: LeaveRequest[] }; lang: "ar" | "en"; loading: boolean }) {
  return (
    <Panel title={title}>
      {loading && <LoadingState label={l(lang, "جاري التحميل...", "Loading...")} />}
      {!loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/50 p-3">
              <div className="text-2xl font-bold text-foreground">{window?.onLeaveCount ?? 0}</div>
              <div className="text-xs text-muted-foreground">{l(lang, "خارج العمل", "Away")}</div>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <div className="text-2xl font-bold text-foreground">{window?.availableCount ?? 0}</div>
              <div className="text-xs text-muted-foreground">{l(lang, "متاح", "Available")}</div>
            </div>
          </div>
          {!window?.onLeave.length && <EmptyState label={l(lang, "لا توجد إجازات", "No absences")} />}
          {!!window?.onLeave.length && (
            <div className="space-y-2">
              {window.onLeave.map((leave) => (
                <div key={leave.id} className="flex items-center justify-between gap-3 text-sm border-b border-border/60 last:border-0 pb-2 last:pb-0">
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">{leave.employee.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{leave.department?.name ?? leave.leaveType}</div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(leave.startsAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function TaskList({ items, lang, emptyLabel }: { items: Task[]; lang: "ar" | "en"; emptyLabel: string }) {
  if (!items.length) {
    return <EmptyState label={emptyLabel} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {[l(lang, "الرقم", "Number"), l(lang, "المهمة", "Task"), l(lang, "المكلف", "Assignee"), l(lang, "الحالة", "Status"), l(lang, "الأولوية", "Priority"), l(lang, "الاستحقاق", "Due")].map((header) => (
              <th key={header} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((task) => (
            <tr key={task.id} className="border-b border-border/60 last:border-0">
              <td className="px-4 py-3 text-xs font-bold text-muted-foreground whitespace-nowrap">{task.taskNumber}</td>
              <td className="px-4 py-3 min-w-60">
                <div className="font-semibold text-foreground">{task.title}</div>
                <div className="text-xs text-muted-foreground">{task.department?.name ?? "-"}</div>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                {task.assignees.map((assignee) => assignee.user.name).join(", ") || "-"}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={task.status} lang={lang} />
              </td>
              <td className="px-4 py-3">
                <PriorityBadge priority={task.priority} lang={lang} />
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{task.dueAt ? formatDate(task.dueAt) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function l(lang: "ar" | "en", ar: string, en: string) {
  return lang === "ar" ? ar : en;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function formatDecimal(value: string | number) {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function leaveStatusLabel(lang: "ar" | "en", status: LeaveStatus) {
  const labels: Record<LeaveStatus, [string, string]> = {
    PENDING: ["معلق", "Pending"],
    INFO_REQUESTED: ["بانتظار معلومات", "Info requested"],
    APPROVED: ["موافق عليه", "Approved"],
    REJECTED: ["مرفوض", "Rejected"],
    CANCELLED: ["ملغى", "Cancelled"]
  };
  return l(lang, labels[status][0], labels[status][1]);
}

function taskStatusLabel(lang: "ar" | "en", status: TaskStatus) {
  const labels: Record<TaskStatus, [string, string]> = {
    NEW: ["جديد", "New"],
    ASSIGNED: ["مُعيَّن", "Assigned"],
    IN_PROGRESS: ["قيد التنفيذ", "In progress"],
    PENDING: ["معلق", "Pending"],
    COMPLETED: ["مكتمل", "Completed"],
    CANCELLED: ["ملغى", "Cancelled"]
  };
  return l(lang, labels[status][0], labels[status][1]);
}

function priorityLabel(lang: "ar" | "en", priority: TaskPriority) {
  const labels: Record<TaskPriority, [string, string]> = {
    LOW: ["منخفض", "Low"],
    MEDIUM: ["متوسط", "Medium"],
    HIGH: ["عالٍ", "High"],
    CRITICAL: ["حرج", "Critical"]
  };
  return l(lang, labels[priority][0], labels[priority][1]);
}
