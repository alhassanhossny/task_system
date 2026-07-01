import { apiFetch } from "@/lib/api/client";
import type { TaskDepartment, TaskUser } from "@/features/tasks/tasks-service";

export type LeaveStatus = "PENDING" | "INFO_REQUESTED" | "APPROVED" | "REJECTED" | "CANCELLED";
export type LeaveDurationType = "FULL_DAY" | "HALF_DAY" | "HOURS";
export type LeaveHalfDayPeriod = "MORNING" | "AFTERNOON";
export type LeaveApprovalMode = "MANAGER_ONLY" | "MANAGER_HR";
type DecimalValue = number | string;

export interface LeaveUser extends TaskUser {
  departmentId?: string | null;
  department?: TaskDepartment | null;
}

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
  durationType: LeaveDurationType;
  durationDays: DecimalValue;
  durationHours?: DecimalValue | null;
  halfDayPeriod?: LeaveHalfDayPeriod | null;
  status: LeaveStatus;
  reason?: string | null;
  submittedAt: string;
  infoRequestedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  cancelledAt?: string | null;
  employee: Pick<LeaveUser, "id" | "name" | "email" | "jobTitle">;
  department?: TaskDepartment | null;
  leaveTypeRef?: Pick<LeaveType, "id" | "name" | "code" | "isPaid"> | null;
  activities?: LeaveActivity[];
  approvalActions?: ApprovalAction[];
}

export interface LeaveFilters {
  status?: LeaveStatus | "";
  employeeId?: string;
  leaveTypeId?: string;
  departmentId?: string;
  startsFrom?: string;
  startsTo?: string;
  search?: string;
}

export interface CreateLeavePayload {
  leaveTypeId: string;
  employeeId?: string;
  startsAt: string;
  endsAt: string;
  durationType?: LeaveDurationType;
  durationHours?: number;
  halfDayPeriod?: LeaveHalfDayPeriod;
  reason?: string;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  allocatedDays: DecimalValue;
  usedDays: DecimalValue;
  remainingDays: DecimalValue;
  year: number;
  employee: Pick<LeaveUser, "id" | "name" | "email" | "jobTitle">;
  leaveType: Pick<LeaveType, "id" | "name" | "code" | "isPaid">;
}

export interface LeaveSettings {
  id: string;
  approvalMode: LeaveApprovalMode;
}

export interface LeaveAvailability {
  from: string;
  to: string;
  totalEmployees: number;
  onLeaveCount: number;
  availableCount: number;
  onLeave: LeaveRequest[];
  available: Array<Pick<LeaveUser, "id" | "name" | "email" | "jobTitle"> & { department?: TaskDepartment | null }>;
}

export interface LeaveDateRange {
  from: string;
  to: string;
  departmentId?: string;
}

interface ApiContext {
  token: string;
  companyId: string;
}

function queryString(filters: object = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, String(value));
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
  requestInfo(context: ApiContext, id: string, comment?: string) {
    return apiFetch<LeaveRequest>(`/leave-requests/${id}/request-info`, {
      method: "POST",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify({ comment })
    });
  },
  balances(context: ApiContext, filters: { employeeId?: string; year?: number } = {}) {
    return apiFetch<LeaveBalance[]>(`/leave-balances${queryString(filters)}`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  settings(context: ApiContext) {
    return apiFetch<LeaveSettings>("/leave-settings", {
      token: context.token,
      companyId: context.companyId
    });
  },
  updateSettings(context: ApiContext, approvalMode: LeaveApprovalMode) {
    return apiFetch<{ setting: LeaveSettings }>("/leave-settings", {
      method: "PATCH",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify({ approvalMode })
    });
  },
  calendar(context: ApiContext, range: LeaveDateRange) {
    return apiFetch<LeaveRequest[]>(`/leave-requests/calendar${queryString(range)}`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  availability(context: ApiContext, range: LeaveDateRange) {
    return apiFetch<LeaveAvailability>(`/leave-requests/availability${queryString(range)}`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  users(context: ApiContext) {
    return apiFetch<LeaveUser[]>("/users", {
      token: context.token,
      companyId: context.companyId
    });
  }
};
