import { apiFetch } from "@/lib/api/client";
import type { TaskDepartment, TaskUser } from "@/features/tasks/tasks-service";

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isPaid: boolean;
  annualAllowanceDays?: number | null;
  isActive: boolean;
}

export interface ApprovalAction {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  comment?: string | null;
  step?: {
    id: string;
    name: string;
    stepOrder: number;
    approverRole?: { name: string; systemName: string } | null;
  } | null;
  actor?: Pick<TaskUser, "id" | "name" | "email"> | null;
}

export interface LeaveActivity {
  id: string;
  type: string;
  title: string;
  titleAr?: string | null;
  createdAt: string;
  actor?: Pick<TaskUser, "id" | "name" | "email"> | null;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  departmentId?: string | null;
  leaveTypeId?: string | null;
  leaveType: string;
  startsAt: string;
  endsAt: string;
  status: LeaveStatus;
  reason?: string | null;
  submittedAt: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  cancelledAt?: string | null;
  employee: Pick<TaskUser, "id" | "name" | "email" | "jobTitle">;
  department?: TaskDepartment | null;
  leaveTypeRef?: Pick<LeaveType, "id" | "name" | "code" | "isPaid"> | null;
  activities?: LeaveActivity[];
  approvalActions?: ApprovalAction[];
}

export interface LeaveFilters {
  status?: LeaveStatus | "";
  employeeId?: string;
  leaveTypeId?: string;
  startsFrom?: string;
  startsTo?: string;
  search?: string;
}

export interface CreateLeavePayload {
  leaveTypeId: string;
  employeeId?: string;
  startsAt: string;
  endsAt: string;
  reason?: string;
}

interface ApiContext {
  token: string;
  companyId: string;
}

function queryString(filters: LeaveFilters = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export const leavesService = {
  list(context: ApiContext, filters: LeaveFilters = {}) {
    return apiFetch<LeaveRequest[]>(`/leave-requests${queryString(filters)}`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  get(context: ApiContext, id: string) {
    return apiFetch<LeaveRequest>(`/leave-requests/${id}`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  history(context: ApiContext, id: string) {
    return apiFetch<Pick<LeaveRequest, "activities" | "approvalActions">>(`/leave-requests/${id}/history`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  types(context: ApiContext) {
    return apiFetch<LeaveType[]>("/leave-types", {
      token: context.token,
      companyId: context.companyId
    });
  },
  create(context: ApiContext, payload: CreateLeavePayload) {
    return apiFetch<LeaveRequest>("/leave-requests", {
      method: "POST",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify(payload)
    });
  },
  approve(context: ApiContext, id: string, comment?: string) {
    return apiFetch<LeaveRequest>(`/leave-requests/${id}/approve`, {
      method: "POST",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify({ comment })
    });
  },
  reject(context: ApiContext, id: string, comment?: string) {
    return apiFetch<LeaveRequest>(`/leave-requests/${id}/reject`, {
      method: "POST",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify({ comment })
    });
  },
  cancel(context: ApiContext, id: string, comment?: string) {
    return apiFetch<LeaveRequest>(`/leave-requests/${id}/cancel`, {
      method: "POST",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify({ comment })
    });
  },
  users(context: ApiContext) {
    return apiFetch<TaskUser[]>("/users", {
      token: context.token,
      companyId: context.companyId
    });
  }
};
