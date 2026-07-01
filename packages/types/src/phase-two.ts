export type TaskStatus = "NEW" | "ASSIGNED" | "IN_PROGRESS" | "PENDING" | "COMPLETED" | "CANCELLED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type LeaveStatus = "PENDING" | "INFO_REQUESTED" | "APPROVED" | "REJECTED" | "CANCELLED";
export type LeaveDurationType = "FULL_DAY" | "HALF_DAY" | "HALF_DAY_AM" | "HALF_DAY_PM" | "HOURS";
export type LeaveRequestType = "LEAVE" | "PERMISSION";
export type LeaveHalfDayPeriod = "MORNING" | "AFTERNOON";
export type LeaveApprovalMode = "MANAGER_ONLY" | "MANAGER_HR";
export type EmailDirection = "inbound" | "outbound";
export type EmailStatus = "DRAFT" | "QUEUED" | "SENDING" | "SENT" | "FAILED" | "CANCELLED";
export type EmailRecipientKind = "TO" | "CC" | "BCC";
export type EmailRecipientType = "EMPLOYEE" | "CLIENT" | "EXTERNAL";
export type EntityType = "TASK" | "EMAIL" | "LEAVE_REQUEST" | "EMPLOYEE" | "USER" | "DEPARTMENT" | "COMPANY" | "CLIENT";
export type NotificationType =
  | "TASK_ASSIGNED"
  | "TASK_COMPLETED"
  | "TASK_DUE_SOON"
  | "TASK_OVERDUE"
  | "LEAVE_SUBMITTED"
  | "LEAVE_INFO_REQUESTED"
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED"
  | "LEAVE_CANCELLED"
  | "EMAIL_QUEUED"
  | "EMAIL_SENT"
  | "EMAIL_FAILED"
  | "SYSTEM";
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
  leaveTypeId: string;
  requestNumber?: string | null;
  requestType: LeaveRequestType;
  startsAt: string;
  endsAt: string;
  startTime?: string | null;
  endTime?: string | null;
  durationType: LeaveDurationType;
  durationDays: number;
  durationHours?: number | null;
  halfDayPeriod?: LeaveHalfDayPeriod | null;
  status: LeaveStatus;
  reason?: string | null;
}

export interface LeaveBalanceDraft {
  companyId: string;
  employeeId: string;
  leaveTypeId: string;
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
  year: number;
}

export interface LeaveSettingDraft {
  companyId: string;
  approvalMode: LeaveApprovalMode;
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

export interface EmailDraft {
  companyId: string;
  createdById?: string | null;
  templateId?: string | null;
  subject: string;
  body: string;
  status: EmailStatus;
  replyTo?: string | null;
}

export interface EmailRecipientDraft {
  companyId: string;
  emailId: string;
  userId?: string | null;
  recipientType: EmailRecipientType;
  recipientKind: EmailRecipientKind;
  email: string;
  name?: string | null;
}

export interface EmailTemplateDraft {
  companyId: string;
  name: string;
  subject: string;
  body: string;
  isSystem: boolean;
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

export interface SavedFilterDraft {
  companyId: string;
  userId: string;
  entityType: EntityType;
  name: string;
  filterJson: Record<string, unknown>;
}

export interface RecentSearchDraft {
  companyId: string;
  userId: string;
  query: string;
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
