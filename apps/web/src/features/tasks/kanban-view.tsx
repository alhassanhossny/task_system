"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, MoreHorizontal, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useAuth } from "@/features/auth/auth-store";
import { PriorityBadge } from "@/features/prototype/badges";
import { useUiText } from "@/features/prototype/use-ui-text";
import {
  avatarColor,
  buildCreatePayload,
  buildUpdatePayload,
  firstAssignee,
  formatDate,
  labelFor,
  normalizePriority,
  TaskDetailPanel,
  TaskFormModal,
  taskQueryKeys,
  TASK_STATUSES,
  useTaskOptions,
  type TaskFormValues
} from "./task-widgets";
import { Task, tasksService } from "./tasks-service";

const COLUMN_STYLES: Record<string, { dot: string; hdr: string }> = {
  NEW: { dot: "bg-slate-400", hdr: "bg-slate-50 dark:bg-slate-800/60" },
  ASSIGNED: { dot: "bg-blue-500", hdr: "bg-blue-50 dark:bg-blue-900/20" },
  IN_PROGRESS: { dot: "bg-amber-500", hdr: "bg-amber-50 dark:bg-amber-900/20" },
  PENDING: { dot: "bg-purple-500", hdr: "bg-purple-50 dark:bg-purple-900/20" },
  COMPLETED: { dot: "bg-green-500", hdr: "bg-green-50 dark:bg-green-900/20" },
  CANCELLED: { dot: "bg-red-400", hdr: "bg-red-50 dark:bg-red-900/20" }
};

export function KanbanView() {
  const { t, lang } = useUiText();
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const context = useMemo(() => (accessToken && user ? { token: accessToken, companyId: user.companyId } : null), [accessToken, user]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { users, departments } = useTaskOptions(context);

  const tasksQuery = useQuery({
    queryKey: taskQueryKeys.list({ kanban: true }),
    queryFn: () => tasksService.list(context!),
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

  const tasks = tasksQuery.data ?? [];

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
    <div className="p-6 flex flex-col h-full">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.kanban}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tasks.length} {t.totalTasks}
          </p>
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

      {tasksQuery.isLoading && <LoadingState label={t.loading} />}
      {tasksQuery.isError && <ErrorState label={t.error} />}
      {!tasksQuery.isLoading && !tasksQuery.isError && !tasks.length && <EmptyState label={t.noTasks} />}

      {!!tasks.length && (
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden" style={{ direction: "ltr" }}>
          <div className="flex gap-3 h-full pb-3" style={{ width: "max-content", minWidth: "100%" }}>
            {TASK_STATUSES.map((column) => {
              const style = COLUMN_STYLES[column.value];
              const columnTasks = tasks.filter((task) => task.status === column.value);
              return (
                <div key={column.value} className="w-72 flex flex-col gap-2 flex-shrink-0" style={{ direction: lang === "ar" ? "rtl" : "ltr" }}>
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${style.hdr}`}>
                    <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                    <span className="text-sm font-semibold text-foreground">{labelFor(lang, column)}</span>
                    <span className="ms-auto w-5 h-5 bg-background rounded-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                      {columnTasks.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                    {columnTasks.map((task) => {
                      const assignee = firstAssignee(task);
                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          className={`bg-card rounded-xl border ${
                            selectedTaskId === task.id ? "border-primary shadow-md ring-1 ring-primary/20" : "border-border hover:shadow-sm"
                          } p-3.5 cursor-pointer transition-all group`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-bold text-muted-foreground mb-1">{task.taskNumber}</p>
                              <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{task.title}</p>
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between mb-3">
                            <PriorityBadge priority={normalizePriority(task.priority)} lang={lang} />
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {formatDate(task.dueAt, lang)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-2.5 border-t border-border/60">
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md truncate max-w-40">{task.department?.name ?? "-"}</span>
                            <div className={`w-6 h-6 ${avatarColor(assignee?.id ?? task.id)} rounded-full flex items-center justify-center text-white text-[10px] font-bold`}>
                              {(assignee?.name ?? "?")[0]}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {columnTasks.length === 0 && (
                      <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                        <p className="text-sm text-muted-foreground/60">{t.noTasks}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
