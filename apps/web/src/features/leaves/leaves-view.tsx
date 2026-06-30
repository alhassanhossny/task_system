"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Check, Clock, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useAuth } from "@/features/auth/auth-store";
import { Av } from "@/features/prototype/avatar";
import { StatusBadge } from "@/features/prototype/badges";
import { useUiText } from "@/features/prototype/use-ui-text";
import { formatDate } from "@/features/tasks/task-widgets";
import { CreateLeavePayload, LeaveFilters, LeaveRequest, LeaveStatus, leavesService, LeaveType } from "./leaves-service";

const leaveQueryKeys = {
  lists: ["leaves"] as const,
  list: (filters: unknown) => ["leaves", "list", filters] as const,
  detail: (id: string | null) => ["leaves", "detail", id] as const,
  types: ["leaves", "types"] as const,
  users: ["leaves", "users"] as const
};

const LEAVE_STATUSES: Array<{ value: LeaveStatus; ar: string; en: string }> = [
  { value: "PENDING", ar: "معلق", en: "Pending" },
  { value: "APPROVED", ar: "موافق عليه", en: "Approved" },
  { value: "REJECTED", ar: "مرفوض", en: "Rejected" },
  { value: "CANCELLED", ar: "ملغى", en: "Cancelled" }
];

export function LeavesView() {
  const { t, lang } = useUiText();
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const context = useMemo(() => (accessToken && user ? { token: accessToken, companyId: user.companyId } : null), [accessToken, user]);
  const [filters, setFilters] = useState<LeaveFilters>({});
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const createMutation = useMutation({
    mutationFn: (payload: CreateLeavePayload) => leavesService.create(context!, payload),
    onSuccess: (leave) => {
      setFormOpen(false);
      setSelectedId(leave.id);
      void queryClient.invalidateQueries({ queryKey: leaveQueryKeys.lists });
    }
  });
  const approveMutation = useMutation({
    mutationFn: (id: string) => leavesService.approve(context!, id),
    onSuccess: (leave) => {
      void queryClient.invalidateQueries({ queryKey: leaveQueryKeys.lists });
      void queryClient.invalidateQueries({ queryKey: leaveQueryKeys.detail(leave.id) });
    }
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => leavesService.reject(context!, id),
    onSuccess: (leave) => {
      void queryClient.invalidateQueries({ queryKey: leaveQueryKeys.lists });
      void queryClient.invalidateQueries({ queryKey: leaveQueryKeys.detail(leave.id) });
    }
  });
  const cancelMutation = useMutation({
    mutationFn: (id: string) => leavesService.cancel(context!, id),
    onSuccess: (leave) => {
      void queryClient.invalidateQueries({ queryKey: leaveQueryKeys.lists });
      void queryClient.invalidateQueries({ queryKey: leaveQueryKeys.detail(leave.id) });
    }
  });

  const leaves = leavesQuery.data ?? [];

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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-5">
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
                  {leaveDays(leave)} {t.days}
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

function leaveDays(leave: LeaveRequest) {
  const start = new Date(leave.startsAt).getTime();
  const end = new Date(leave.endsAt).getTime();
  return Math.max(1, Math.ceil((end - start) / 86400000) + 1);
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
  const [payload, setPayload] = useState<CreateLeavePayload>({ leaveTypeId: "", startsAt: "", endsAt: "", reason: "" });

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
              <Info label={lang === "ar" ? "الأيام" : "Days"} value={String(leaveDays(leave))} />
              <Info label={lang === "ar" ? "القسم" : "Department"} value={leave.department?.name ?? "-"} />
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
