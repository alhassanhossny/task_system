export type TaskStatus = "new" | "assigned" | "in_progress" | "pending" | "completed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type EmailDirection = "inbound" | "outbound";

export interface TaskDraft {
  companyId: string;
  departmentId?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt?: string | null;
  assigneeIds: string[];
}

export interface LeaveRequestDraft {
  companyId: string;
  employeeId: string;
  leaveType: string;
  startsAt: string;
  endsAt: string;
  status: LeaveStatus;
  reason?: string | null;
}

export interface EmailMessageDraft {
  companyId: string;
  direction: EmailDirection;
  subject: string;
  body: string;
  fromAddress: string;
  toAddresses: string[];
  readAt?: string | null;
}
