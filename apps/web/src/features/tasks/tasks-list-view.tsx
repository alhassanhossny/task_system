"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Filter, Plus, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useAuth } from "@/features/auth/auth-store";
import { PriorityBadge, StatusBadge } from "@/features/prototype/badges";
import { useUiText } from "@/features/prototype/use-ui-text";
import {
  assigneeNames,
  avatarColor,
  buildCreatePayload,
  buildUpdatePayload,
  firstAssignee,
  formatDate,
  labelFor,
  normalizePriority,
  normalizeStatus,
  TaskDetailPanel,
  TaskFormModal,
  taskQueryKeys,
  TASK_PRIORITIES,
  TASK_STATUSES,
  useTaskOptions,
  type TaskFormValues
} from "./task-widgets";
import { Task, TaskFilters, TaskPriority, TaskStatus, tasksService } from "./tasks-service";

export function TasksListView() {
  const { t, lang } = useUiText();
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const context = useMemo(() => (accessToken && user ? { token: accessToken, companyId: user.companyId } : null), [accessToken, user]);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { users, departments } = useTaskOptions(context);

  useEffect(() => {
    setFilters({
      status: (searchParams.get("status") as TaskStatus | null) ?? undefined,
      priority: (searchParams.get("priority") as TaskPriority | null) ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
      assignedToId: searchParams.get("assignedToId") ?? undefined,
      dueFrom: searchParams.get("dueFrom") ?? undefined,
      dueTo: searchParams.get("dueTo") ?? undefined,
      search: searchParams.get("search") ?? undefined
    });
  }, [searchParams]);

  const tasksQuery = useQuery({
    queryKey: taskQueryKeys.list(filters),
    queryFn: () => tasksService.list(context!, filters),
    enabled: Boolean(context)
  });

  const createMutation = useMutation({
    mutationFn: (values: TaskFormValues) => tasksService.create(context!, buildCreatePayload(values)),
    onSuccess: (task) => {
      setFormOpen(false);
      setEditingTask(null);
      setSelectedTaskId(task.id);
      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ task, values }: { task: Task; values: TaskFormValues }) => {
      const updated = await tasksService.update(context!, task.id, buildUpdatePayload(values));
      await tasksService.assign(context!, task.id, values.assigneeId ? [values.assigneeId] : []);
      return updated;
    },
    onSuccess: (task) => {
      setFormOpen(false);
      setEditingTask(null);
      setSelectedTaskId(task.id);
      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists });
      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.detail(task.id) });
    }
  });

  const rows = tasksQuery.data ?? [];
  const countLabel = `${rows.length} ${t.tasks_count}`;

  function submitForm(values: TaskFormValues) {
    if (editingTask) {
      updateMutation.mutate({ task: editingTask, values });
      return;
    }

    createMutation.mutate(values);
  }

  if (!context) {
    return <ErrorState label={lang === "ar" ? "سجّل الدخول لعرض المهام" : "Sign in to view tasks"} />;
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.taskList}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{countLabel}</p>
        </div>
        <button
          onClick={() => {
            setEditingTask(null);
            setFormOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          {t.addTask}
        </button>
      </div>

      <div className="space-y-3 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilters((current) => ({ ...current, status: "" }))}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !filters.status ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {lang === "ar" ? "الكل" : "All"}
          </button>
          {TASK_STATUSES.map((status) => (
            <button
              key={status.value}
              onClick={() => setFilters((current) => ({ ...current, status: status.value }))}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filters.status === status.value ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {labelFor(lang, status)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <label className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute top-1/2 -translate-y-1/2 start-3" />
            <input
              value={filters.search ?? ""}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder={t.globalSearch}
              className="w-full rounded-xl border border-border bg-card ps-9 pe-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <select
            value={filters.priority ?? ""}
            onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value as TaskPriority | "" }))}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">{t.priority}</option>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {labelFor(lang, priority)}
              </option>
            ))}
          </select>
          <select
            value={filters.departmentId ?? ""}
            onChange={(event) => setFilters((current) => ({ ...current, departmentId: event.target.value }))}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">{t.department}</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <select
            value={filters.assignedToId ?? ""}
            onChange={(event) => setFilters((current) => ({ ...current, assignedToId: event.target.value }))}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">{t.assignee}</option>
            {users.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <Filter className="w-4 h-4" />
          <input
            type="date"
            value={filters.dueFrom ?? ""}
            onChange={(event) => setFilters((current) => ({ ...current, dueFrom: event.target.value }))}
            className="rounded-lg border border-border bg-card px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span>{lang === "ar" ? "إلى" : "to"}</span>
          <input
            type="date"
            value={filters.dueTo ?? ""}
            onChange={(event) => setFilters((current) => ({ ...current, dueTo: event.target.value }))}
            className="rounded-lg border border-border bg-card px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {tasksQuery.isLoading && <LoadingState label={t.loading} />}
        {tasksQuery.isError && <ErrorState label={t.error} />}
        {!tasksQuery.isLoading && !tasksQuery.isError && !rows.length && <EmptyState label={t.noTasks} />}
        {!!rows.length && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {[lang === "ar" ? "رقم المهمة" : "Task #", t.name, t.status, t.priority, t.assignee, t.dueDate, t.department].map((h) => (
                    <th key={h} className="px-4 py-3.5 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((task) => {
                  const assignee = firstAssignee(task);
                  return (
                    <tr key={task.id} onClick={() => setSelectedTaskId(task.id)} className="border-b border-border/60 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer">
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">{task.taskNumber}</span>
                      </td>
                      <td className="px-4 py-3.5 min-w-64">
                        <span className="text-sm font-medium text-foreground">{task.title}</span>
                        {task.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{task.description}</p>}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={normalizeStatus(task.status)} lang={lang} />
                      </td>
                      <td className="px-4 py-3.5">
                        <PriorityBadge priority={normalizePriority(task.priority)} lang={lang} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 ${avatarColor(assignee?.id ?? task.id)} rounded-full flex items-center justify-center text-white text-[10px] font-bold`}>
                            {(assignee?.name ?? "?")[0]}
                          </div>
                          <span className="text-sm text-foreground whitespace-nowrap">{assigneeNames(task, lang)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(task.dueAt, lang)}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{task.department?.name ?? "-"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TaskFormModal
        lang={lang}
        open={formOpen}
        task={editingTask}
        users={users}
        departments={departments}
        submitting={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          setFormOpen(false);
          setEditingTask(null);
        }}
        onSubmit={submitForm}
      />
      <TaskDetailPanel
        lang={lang}
        context={context}
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onEdit={(task) => {
          setEditingTask(task);
          setFormOpen(true);
        }}
        onDeleted={() => setSelectedTaskId(null)}
      />
    </div>
  );
}
