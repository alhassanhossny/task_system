export type TaskStatus = "NEW" | "ASSIGNED" | "IN_PROGRESS" | "PENDING" | "COMPLETED" | "CANCELLED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type EmailDirection = "inbound" | "outbound";
export type EntityType = "TASK" | "EMAIL" | "LEAVE_REQUEST" | "EMPLOYEE" | "USER" | "DEPARTMENT" | "COMPANY" | "CLIENT";
export type NotificationType = "TASK_ASSIGNED" | "TASK_COMPLETED" | "TASK_DUE_SOON" | "LEAVE_SUBMITTED" | "LEAVE_APPROVED" | "EMAIL_SENT" | "SYSTEM";
export type SmtpEncryption = "NONE" | "STARTTLS" | "SSL_TLS";
export type ApprovalActionStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type ThemePreference = "SYSTEM" | "LIGHT" | "DARK";

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

export interface AttachmentDraft {
  companyId: string;
  entityType: EntityType;
  entityId: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  uploadedById?: string | null;
}

export interface CommentDraft {
  companyId: string;
  entityType: EntityType;
  entityId: string;
  userId: string;
  content: string;
}

export interface NotificationDraft {
  companyId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: EntityType | null;
  entityId?: string | null;
}

export interface SmtpSettingDraft {
  companyId: string;
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
  encryption: SmtpEncryption;
  fromName: string;
  fromEmail: string;
}

export interface SearchIndexDraft {
  companyId: string;
  entityType: EntityType;
  entityId: string;
  title: string;
  content: string;
}

export interface ApprovalWorkflowDraft {
  companyId: string;
  entityType: EntityType;
  name: string;
  description?: string | null;
  isActive: boolean;
}

export interface ApprovalStepDraft {
  companyId: string;
  workflowId: string;
  stepOrder: number;
  name: string;
  approverRoleId?: string | null;
  approverUserId?: string | null;
}

export interface ApprovalActionDraft {
  companyId: string;
  workflowId: string;
  stepId?: string | null;
  entityType: EntityType;
  entityId: string;
  actorId?: string | null;
  status: ApprovalActionStatus;
  comment?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TagDraft {
  companyId: string;
  name: string;
  color?: string | null;
  createdById?: string | null;
}

export interface EntityTagDraft {
  companyId: string;
  tagId: string;
  entityType: EntityType;
  entityId: string;
  createdById?: string | null;
}

export interface UserPreferenceDraft {
  companyId: string;
  userId: string;
  language: "ar" | "en";
  theme: ThemePreference;
  sidebarCollapsed: boolean;
  dashboardLayout: Record<string, unknown>;
}
