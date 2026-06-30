"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CheckCircle2, Clock, FileText, Paperclip, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PriorityBadge, StatusBadge } from "@/features/prototype/badges";
import type { Lang } from "@/features/prototype/types";
import {
  Task,
  TaskDepartment,
  TaskPriority,
  TaskStatus,
  TaskUser,
  tasksService,
  type CreateTaskAttachmentPayload,
  type CreateTaskPayload,
  type UpdateTaskPayload
} from "./tasks-service";

export const TASK_STATUSES: Array<{ value: TaskStatus; key: string; ar: string; en: string }> = [
  { value: "NEW", key: "new", ar: "جديد", en: "New" },
  { value: "ASSIGNED", key: "assigned", ar: "مُعيَّن", en: "Assigned" },
  { value: "IN_PROGRESS", key: "inProgress", ar: "قيد التنفيذ", en: "In Progress" },
  { value: "PENDING", key: "pending", ar: "معلق", en: "Pending" },
  { value: "COMPLETED", key: "completed", ar: "مكتمل", en: "Completed" },
  { value: "CANCELLED", key: "cancelled", ar: "ملغى", en: "Cancelled" }
];

export const TASK_PRIORITIES: Array<{ value: TaskPriority; key: string; ar: string; en: string }> = [
  { value: "LOW", key: "low", ar: "منخفض", en: "Low" },
  { value: "MEDIUM", key: "medium", ar: "متوسط", en: "Medium" },
  { value: "HIGH", key: "high", ar: "عالٍ", en: "High" },
  { value: "CRITICAL", key: "critical", ar: "حرج", en: "Critical" }
];

export const taskQueryKeys = {
  lists: ["tasks"] as const,
  list: (filters: unknown) => ["tasks", "list", filters] as const,
  detail: (id: string | null) => ["tasks", "detail", id] as const,
  comments: (id: string | null) => ["tasks", "comments", id] as const,
  attachments: (id: string | null) => ["tasks", "attachments", id] as const,
  users: ["tasks", "users"] as const,
  departments: ["tasks", "departments"] as const
};

const taskFormSchema = z.object({
  title: z.string().min(2).max(255),
  description: z.string().max(5000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  departmentId: z.string().optional(),
  assigneeId: z.string().optional(),
  dueAt: z.string().optional(),
  estimatedHours: z.preprocess((value) => (value === "" || value === undefined ? undefined : Number(value)), z.number().min(0).max(99999).optional())
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export interface TaskApiContext {
  token: string;
  companyId: string;
}

export function buildCreatePayload(values: TaskFormValues): CreateTaskPayload {
  return {
    title: values.title,
    description: values.description || undefined,
    priority: values.priority,
    departmentId: values.departmentId || undefined,
    assigneeIds: values.assigneeId ? [values.assigneeId] : [],
    dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : undefined,
    estimatedHours: values.estimatedHours
  };
}

export function buildUpdatePayload(values: TaskFormValues): UpdateTaskPayload {
  return {
    title: values.title,
    description: values.description || null,
    priority: values.priority,
    departmentId: values.departmentId || null,
    dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : null,
    estimatedHours: values.estimatedHours ?? null
  };
}

export function labelFor(lang: Lang, item: { ar: string; en: string }) {
  return lang === "ar" ? item.ar : item.en;
}

export function normalizeStatus(status: string) {
  return status.toLowerCase().replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export function normalizePriority(priority: string) {
  return priority.toLowerCase();
}

export function formatDate(value: string | null | undefined, lang: Lang) {
  if (!value) {
    return lang === "ar" ? "غير محدد" : "Unscheduled";
  }

  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

export function toInputDate(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

export function firstAssignee(task: Task) {
  return task.assignees[0]?.user;
}

export function assigneeNames(task: Task, lang: Lang) {
  if (!task.assignees.length) {
    return lang === "ar" ? "غير معين" : "Unassigned";
  }

  return task.assignees.map((assignee) => assignee.user.name).join(", ");
}

export function avatarColor(seed: string) {
  const colors = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-rose-500", "bg-amber-500"];
  return colors[seed.length % colors.length];
}

export function TaskFormModal({
  lang,
  open,
  task,
  users,
  departments,
  submitting,
  onClose,
  onSubmit
}: {
  lang: Lang;
  open: boolean;
  task?: Task | null;
  users: TaskUser[];
  departments: TaskDepartment[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "MEDIUM",
      departmentId: "",
      assigneeId: "",
      dueAt: "",
      estimatedHours: undefined
    }
  });

  useEffect(() => {
    reset({
      title: task?.title ?? "",
      description: task?.description ?? "",
      priority: task?.priority ?? "MEDIUM",
      departmentId: task?.departmentId ?? "",
      assigneeId: task?.assignees[0]?.userId ?? "",
      dueAt: toInputDate(task?.dueAt),
      estimatedHours: task?.estimatedHours === null || task?.estimatedHours === undefined ? undefined : Number(task.estimatedHours)
    });
  }, [reset, task, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">{task ? (lang === "ar" ? "تعديل المهمة" : "Edit task") : lang === "ar" ? "إضافة مهمة" : "Add task"}</h2>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="md:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "العنوان" : "Title"}</span>
            <input {...register("title")} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            {errors.title && <span className="text-xs text-red-500 mt-1 block">{lang === "ar" ? "العنوان مطلوب" : "Title is required"}</span>}
          </label>
          <label className="md:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "الوصف" : "Description"}</span>
            <textarea
              {...register("description")}
              rows={3}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </label>
          <label>
            <span className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "الأولوية" : "Priority"}</span>
            <select {...register("priority")} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  {labelFor(lang, priority)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "القسم" : "Department"}</span>
            <select {...register("departmentId")} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">{lang === "ar" ? "بدون قسم" : "No department"}</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "المُكلَّف" : "Assignee"}</span>
            <select {...register("assigneeId")} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">{lang === "ar" ? "غير معين" : "Unassigned"}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "تاريخ الاستحقاق" : "Due date"}</span>
            <input {...register("dueAt")} type="date" className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <label>
            <span className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "الساعات المقدرة" : "Estimated hours"}</span>
            <input
              {...register("estimatedHours")}
              type="number"
              min="0"
              step="0.25"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>
        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm font-semibold hover:text-foreground transition-colors">
            {lang === "ar" ? "إلغاء" : "Cancel"}
          </button>
          <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {submitting ? (lang === "ar" ? "جاري الحفظ..." : "Saving...") : lang === "ar" ? "حفظ" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function TaskDetailPanel({
  lang,
  context,
  taskId,
  onClose,
  onEdit,
  onDeleted
}: {
  lang: Lang;
  context: TaskApiContext | null;
  taskId: string | null;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [attachment, setAttachment] = useState<CreateTaskAttachmentPayload>({
    fileName: "",
    filePath: "",
    mimeType: "application/pdf",
    fileSize: 1
  });
  const enabled = Boolean(context && taskId);

  const taskQuery = useQuery({
    queryKey: taskQueryKeys.detail(taskId),
    queryFn: () => tasksService.get(context!, taskId!),
    enabled
  });
  const commentsQuery = useQuery({
    queryKey: taskQueryKeys.comments(taskId),
    queryFn: () => tasksService.comments(context!, taskId!),
    enabled
  });
  const attachmentsQuery = useQuery({
    queryKey: taskQueryKeys.attachments(taskId),
    queryFn: () => tasksService.attachments(context!, taskId!),
    enabled
  });

  const statusMutation = useMutation({
    mutationFn: (status: TaskStatus) => tasksService.updateStatus(context!, taskId!, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists });
      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.detail(taskId) });
    }
  });
  const commentMutation = useMutation({
    mutationFn: (content: string) => tasksService.addComment(context!, taskId!, content),
    onSuccess: () => {
      setComment("");
      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.comments(taskId) });
      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.detail(taskId) });
    }
  });
  const attachmentMutation = useMutation({
    mutationFn: (payload: CreateTaskAttachmentPayload) => tasksService.addAttachment(context!, taskId!, payload),
    onSuccess: () => {
      setAttachment({ fileName: "", filePath: "", mimeType: "application/pdf", fileSize: 1 });
      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.attachments(taskId) });
      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.detail(taskId) });
    }
  });
  const deleteMutation = useMutation({
    mutationFn: () => tasksService.remove(context!, taskId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists });
      onDeleted();
    }
  });

  const task = taskQuery.data;

  if (!taskId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/35 flex justify-end">
      <aside className="w-full max-w-xl h-full bg-card border-s border-border shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">{task?.taskNumber ?? ""}</p>
            <h2 className="text-lg font-bold text-foreground line-clamp-1">{task?.title ?? (lang === "ar" ? "تفاصيل المهمة" : "Task details")}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {taskQuery.isLoading && <PanelState label={lang === "ar" ? "جاري تحميل المهمة..." : "Loading task..."} />}
        {taskQuery.isError && <PanelState label={lang === "ar" ? "تعذر تحميل المهمة" : "Could not load task"} />}

        {task && (
          <div className="p-5 space-y-5">
            <section>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={normalizeStatus(task.status)} lang={lang} />
                    <PriorityBadge priority={normalizePriority(task.priority)} lang={lang} />
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">{task.description || (lang === "ar" ? "لا يوجد وصف" : "No description")}</p>
                </div>
                <button onClick={() => onEdit(task)} className="px-3 py-2 rounded-xl bg-muted text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  {lang === "ar" ? "تعديل" : "Edit"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <InfoTile icon={<Calendar className="w-4 h-4" />} label={lang === "ar" ? "الاستحقاق" : "Due date"} value={formatDate(task.dueAt, lang)} />
                <InfoTile icon={<Clock className="w-4 h-4" />} label={lang === "ar" ? "الساعات" : "Hours"} value={`${task.actualHours ?? 0}/${task.estimatedHours ?? "-"} `} />
                <InfoTile label={lang === "ar" ? "القسم" : "Department"} value={task.department?.name ?? (lang === "ar" ? "بدون قسم" : "No department")} />
                <InfoTile label={lang === "ar" ? "المُكلَّفون" : "Assignees"} value={assigneeNames(task, lang)} />
              </div>

              <div className="mt-5">
                <label className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "تغيير الحالة" : "Change status"}</label>
                <select
                  value={task.status}
                  onChange={(event) => statusMutation.mutate(event.target.value as TaskStatus)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {TASK_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {labelFor(lang, status)}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <SectionTitle icon={<FileText className="w-4 h-4" />} label={lang === "ar" ? "التعليقات" : "Comments"} />
            <section className="space-y-3">
              <div className="space-y-2">
                {(commentsQuery.data ?? []).map((item) => (
                  <div key={item.id} className="rounded-xl bg-muted/50 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-foreground">{item.user.name}</span>
                      <span className="text-[11px] text-muted-foreground">{formatDate(item.createdAt, lang)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-6">{item.content}</p>
                  </div>
                ))}
                {!commentsQuery.isLoading && !commentsQuery.data?.length && <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا توجد تعليقات" : "No comments yet"}</p>}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (comment.trim()) {
                    commentMutation.mutate(comment.trim());
                  }
                }}
                className="flex gap-2"
              >
                <input
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={lang === "ar" ? "اكتب تعليقاً..." : "Write a comment..."}
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60" disabled={commentMutation.isPending}>
                  {lang === "ar" ? "إرسال" : "Send"}
                </button>
              </form>
            </section>

            <SectionTitle icon={<Paperclip className="w-4 h-4" />} label={lang === "ar" ? "المرفقات" : "Attachments"} />
            <section className="space-y-3">
              <div className="space-y-2">
                {(attachmentsQuery.data ?? []).map((item) => (
                  <a
                    key={item.id}
                    href={item.objectUrl ?? "#"}
                    target="_blank"
                    className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5 hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.fileName}</p>
                      <p className="text-xs text-muted-foreground">{Math.ceil(item.fileSize / 1024)} KB</p>
                    </div>
                    <Paperclip className="w-4 h-4 text-muted-foreground" />
                  </a>
                ))}
                {!attachmentsQuery.isLoading && !attachmentsQuery.data?.length && <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا توجد مرفقات" : "No attachments yet"}</p>}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (attachment.fileName && attachment.filePath && attachment.mimeType && attachment.fileSize > 0) {
                    attachmentMutation.mutate(attachment);
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2"
              >
                <input
                  value={attachment.fileName}
                  onChange={(event) => setAttachment((current) => ({ ...current, fileName: event.target.value }))}
                  placeholder={lang === "ar" ? "اسم الملف" : "File name"}
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
                <input
                  value={attachment.filePath}
                  onChange={(event) => setAttachment((current) => ({ ...current, filePath: event.target.value }))}
                  placeholder={lang === "ar" ? "مسار الملف" : "File path"}
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
                <input
                  value={attachment.mimeType}
                  onChange={(event) => setAttachment((current) => ({ ...current, mimeType: event.target.value }))}
                  placeholder="application/pdf"
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
                <input
                  value={attachment.fileSize}
                  onChange={(event) => setAttachment((current) => ({ ...current, fileSize: Number(event.target.value) }))}
                  type="number"
                  min="1"
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button className="sm:col-span-2 px-3 py-2 rounded-xl bg-muted text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors" disabled={attachmentMutation.isPending}>
                  {lang === "ar" ? "إضافة مرفق" : "Add attachment"}
                </button>
              </form>
            </section>

            <SectionTitle icon={<CheckCircle2 className="w-4 h-4" />} label={lang === "ar" ? "سجل النشاط" : "Activity timeline"} />
            <section className="space-y-2">
              {(task.activities ?? []).map((activity) => (
                <div key={activity.id} className="border-s-2 border-primary/30 ps-3 py-1">
                  <p className="text-sm font-medium text-foreground">{lang === "ar" ? activity.titleAr || activity.title : activity.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(activity.createdAt, lang)}</p>
                </div>
              ))}
              {!task.activities?.length && <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا يوجد نشاط" : "No activity yet"}</p>}
            </section>

            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
            >
              <Trash2 className="w-4 h-4" />
              {lang === "ar" ? "حذف المهمة" : "Delete task"}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function PanelState({ label }: { label: string }) {
  return <div className="p-8 text-center text-sm text-muted-foreground">{label}</div>;
}

function SectionTitle({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-bold text-foreground pt-2">
      {icon}
      {label}
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2.5 min-w-0">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-sm font-semibold text-foreground mt-1 truncate">{value}</p>
    </div>
  );
}

export function useTaskOptions(context: TaskApiContext | null) {
  const usersQuery = useQuery({
    queryKey: taskQueryKeys.users,
    queryFn: () => tasksService.users(context!),
    enabled: Boolean(context)
  });
  const departmentsQuery = useQuery({
    queryKey: taskQueryKeys.departments,
    queryFn: () => tasksService.departments(context!),
    enabled: Boolean(context)
  });

  return useMemo(
    () => ({
      users: usersQuery.data ?? [],
      departments: departmentsQuery.data ?? [],
      isLoading: usersQuery.isLoading || departmentsQuery.isLoading
    }),
    [departmentsQuery.data, departmentsQuery.isLoading, usersQuery.data, usersQuery.isLoading]
  );
}
