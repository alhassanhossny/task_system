import { apiFetch } from "@/lib/api/client";
import type { LeaveBalance, LeaveRequest, LeaveStatus } from "@/features/leaves/leaves-service";
import type { Task, TaskPriority, TaskStatus, TaskDepartment, TaskUser } from "@/features/tasks/tasks-service";

export interface TeamMember extends TaskUser {
  companyId: string;
  departmentId?: string | null;
  managerId?: string | null;
  locale?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  department?: TaskDepartment | null;
  manager?: Pick<TaskUser, "id" | "name" | "email"> | null;
  _count?: {
    directReports: number;
    assignedTasks: number;
    leaveRequests: number;
    leaveBalances: number;
  };
}

export interface TeamAvailabilityWindow {
  key: "today" | "thisWeek" | "thisMonth";
  from: string;
  to: string;
  totalMembers: number;
  onLeaveCount: number;
  availableCount: number;
  onLeave: LeaveRequest[];
  available: TeamMember[];
}

export interface TeamAvailability {
  today: TeamAvailabilityWindow;
  thisWeek: TeamAvailabilityWindow;
  thisMonth: TeamAvailabilityWindow;
}

export interface TeamDashboard {
  pendingApprovals: LeaveRequest[];
  awayToday: LeaveRequest[];
  upcomingAbsences: LeaveRequest[];
  teamLeaveBalances: LeaveBalance[];
  openTeamTasks: Task[];
  overdueTeamTasks: Task[];
  counts: {
    pendingApprovals: number;
    awayToday: number;
    upcomingAbsences: number;
    openTeamTasks: number;
    overdueTeamTasks: number;
    teamLeaveBalances: number;
  };
}

export interface TeamLeaveFilters {
  status?: LeaveStatus | "";
  departmentId?: string;
  employeeId?: string;
  leaveTypeId?: string;
  startsFrom?: string;
  startsTo?: string;
  search?: string;
}

export interface TeamTaskFilters {
  status?: TaskStatus | "";
  priority?: TaskPriority | "";
  departmentId?: string;
  employeeId?: string;
  dueFrom?: string;
  dueTo?: string;
  search?: string;
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

export const teamService = {
  dashboard(context: ApiContext) {
    return apiFetch<TeamDashboard>("/team/dashboard", {
      token: context.token,
      companyId: context.companyId
    });
  },
  members(context: ApiContext) {
    return apiFetch<TeamMember[]>("/team/members", {
      token: context.token,
      companyId: context.companyId
    });
  },
  member(context: ApiContext, id: string) {
    return apiFetch<TeamMember>(`/team/member/${id}`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  availability(context: ApiContext, filters: { referenceDate?: string; departmentId?: string; employeeId?: string; leaveTypeId?: string } = {}) {
    return apiFetch<TeamAvailability>(`/team/availability${queryString(filters)}`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  leaveRequests(context: ApiContext, filters: TeamLeaveFilters = {}) {
    return apiFetch<LeaveRequest[]>(`/team/leave-requests${queryString(filters)}`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  pendingApprovals(context: ApiContext, filters: TeamLeaveFilters = {}) {
    return apiFetch<LeaveRequest[]>(`/team/pending-approvals${queryString(filters)}`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  approveLeave(context: ApiContext, id: string, comment?: string) {
    return apiFetch<LeaveRequest>(`/team/leave-requests/${id}/approve`, {
      method: "POST",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify({ comment })
    });
  },
  rejectLeave(context: ApiContext, id: string, comment?: string) {
    return apiFetch<LeaveRequest>(`/team/leave-requests/${id}/reject`, {
      method: "POST",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify({ comment })
    });
  },
  leaveBalances(context: ApiContext, filters: { year?: number; employeeId?: string; leaveTypeId?: string; departmentId?: string } = {}) {
    return apiFetch<LeaveBalance[]>(`/team/leave-balances${queryString(filters)}`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  tasks(context: ApiContext, filters: TeamTaskFilters = {}) {
    return apiFetch<Task[]>(`/team/tasks${queryString(filters)}`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  overdueTasks(context: ApiContext, filters: TeamTaskFilters = {}) {
    return apiFetch<Task[]>(`/team/tasks/overdue${queryString(filters)}`, {
      token: context.token,
      companyId: context.companyId
    });
  }
};
