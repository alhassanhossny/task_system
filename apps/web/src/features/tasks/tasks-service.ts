import { apiFetch } from "@/lib/api/client";

export type TaskStatus = "NEW" | "ASSIGNED" | "IN_PROGRESS" | "PENDING" | "COMPLETED" | "CANCELLED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface TaskUser {
  id: string;
  name: string;
  email: string;
  jobTitle?: string | null;
}

export interface TaskDepartment {
  id: string;
  name: string;
  code: string;
}

export interface TaskParticipant {
  id: string;
  userId: string;
  user: TaskUser;
}

export interface TaskActivity {
  id: string;
  type: string;
  title: string;
  titleAr?: string | null;
  createdAt: string;
  actor?: Pick<TaskUser, "id" | "name" | "email"> | null;
}

export interface TaskComment {
  id: string;
  content: string;
  createdAt: string;
  user: Pick<TaskUser, "id" | "name" | "email">;
}

export interface TaskAttachment {
  id: string;
  fileName: string;
  filePath: string;
  objectUrl?: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploadedBy?: Pick<TaskUser, "id" | "name" | "email"> | null;
}

export interface Task {
  id: string;
  companyId: string;
  departmentId?: string | null;
  createdById?: string | null;
  taskNumber: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt?: string | null;
  completedAt?: string | null;
  reminderSentAt?: string | null;
  estimatedHours?: string | number | null;
  actualHours?: string | number | null;
  createdAt: string;
  updatedAt: string;
  department?: TaskDepartment | null;
  createdBy?: Pick<TaskUser, "id" | "name" | "email"> | null;
  assignees: TaskParticipant[];
  watchers?: TaskParticipant[];
  activities?: TaskActivity[];
  _count?: {
    assignees: number;
    watchers: number;
  };
}

export interface TaskFilters {
  status?: TaskStatus | "";
  priority?: TaskPriority | "";
  departmentId?: string;
  assignedToId?: string;
  dueFrom?: string;
  dueTo?: string;
  search?: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  priority?: TaskPriority;
  departmentId?: string;
  assigneeIds?: string[];
  watcherIds?: string[];
  dueAt?: string;
  estimatedHours?: number;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  departmentId?: string | null;
  dueAt?: string | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
}

export interface CreateTaskAttachmentPayload {
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
}

interface ApiContext {
  token: string;
  companyId: string;
}

function queryString(filters: TaskFilters = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export const tasksService = {
  list(context: ApiContext, filters: TaskFilters = {}) {
    return apiFetch<Task[]>(`/tasks${queryString(filters)}`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  get(context: ApiContext, id: string) {
    return apiFetch<Task>(`/tasks/${id}`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  create(context: ApiContext, payload: CreateTaskPayload) {
    return apiFetch<Task>("/tasks", {
      method: "POST",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify(payload)
    });
  },
  update(context: ApiContext, id: string, payload: UpdateTaskPayload) {
    return apiFetch<Task>(`/tasks/${id}`, {
      method: "PATCH",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify(payload)
    });
  },
  assign(context: ApiContext, id: string, assigneeIds: string[]) {
    return apiFetch<Task>(`/tasks/${id}/assignees`, {
      method: "PATCH",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify({ assigneeIds })
    });
  },
  updateStatus(context: ApiContext, id: string, status: TaskStatus, actualHours?: number) {
    return apiFetch<Task>(`/tasks/${id}/status`, {
      method: "PATCH",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify({ status, actualHours })
    });
  },
  remove(context: ApiContext, id: string) {
    return apiFetch<{ success: true }>(`/tasks/${id}`, {
      method: "DELETE",
      token: context.token,
      companyId: context.companyId
    });
  },
  comments(context: ApiContext, id: string) {
    return apiFetch<TaskComment[]>(`/tasks/${id}/comments`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  addComment(context: ApiContext, id: string, content: string) {
    return apiFetch<TaskComment>(`/tasks/${id}/comments`, {
      method: "POST",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify({ content })
    });
  },
  attachments(context: ApiContext, id: string) {
    return apiFetch<TaskAttachment[]>(`/tasks/${id}/attachments`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  addAttachment(context: ApiContext, id: string, payload: CreateTaskAttachmentPayload) {
    return apiFetch<TaskAttachment>(`/tasks/${id}/attachments`, {
      method: "POST",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify(payload)
    });
  },
  users(context: ApiContext) {
    return apiFetch<TaskUser[]>("/users", {
      token: context.token,
      companyId: context.companyId
    });
  },
  departments(context: ApiContext) {
    return apiFetch<TaskDepartment[]>("/departments", {
      token: context.token,
      companyId: context.companyId
    });
  }
};
