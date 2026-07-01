import { apiFetch } from "@/lib/api/client";
import type { TaskUser } from "@/features/tasks/tasks-service";

export type EmailStatus = "DRAFT" | "QUEUED" | "SENDING" | "SENT" | "FAILED" | "CANCELLED";
export type EmailRecipientKind = "TO" | "CC" | "BCC";
export type EmailRecipientType = "EMPLOYEE" | "CLIENT" | "EXTERNAL";

export interface EmailRecipient {
  id: string;
  recipientType: EmailRecipientType;
  recipientKind: EmailRecipientKind;
  userId?: string | null;
  email: string;
  name?: string | null;
}

export interface EmailAttachment {
  id: string;
  attachment: {
    id: string;
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
  };
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  isSystem: boolean;
}

export interface Email {
  id: string;
  subject: string;
  body: string;
  status: EmailStatus;
  replyTo?: string | null;
  queuedAt?: string | null;
  sentAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: Pick<TaskUser, "id" | "name" | "email"> | null;
  template?: Pick<EmailTemplate, "id" | "name"> | null;
  recipients: EmailRecipient[];
  attachments?: EmailAttachment[];
  _count?: {
    attachments: number;
  };
}

export interface EmailListResponse {
  items: Email[];
  total: number;
  page: number;
  limit: number;
}

export interface EmailFilters {
  status?: EmailStatus | "";
  search?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  limit?: number;
}

export interface CreateEmailPayload {
  subject?: string;
  body?: string;
  templateId?: string;
  variables?: Record<string, string | number | boolean | null>;
  replyTo?: string;
  recipients: Array<{
    recipientKind: EmailRecipientKind;
    recipientType?: EmailRecipientType;
    userId?: string;
    email?: string;
    name?: string;
  }>;
  attachments?: Array<{
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
  }>;
}

export type UpdateEmailPayload = Partial<CreateEmailPayload>;

export interface CreateEmailTemplatePayload {
  name: string;
  subject: string;
  body: string;
  isSystem?: boolean;
}

interface ApiContext {
  token: string;
  companyId: string;
}

function queryString(filters: EmailFilters = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export const emailsService = {
  list(context: ApiContext, filters: EmailFilters = {}) {
    return apiFetch<EmailListResponse>(`/emails${queryString(filters)}`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  get(context: ApiContext, id: string) {
    return apiFetch<Email>(`/emails/${id}`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  create(context: ApiContext, payload: CreateEmailPayload) {
    return apiFetch<Email>("/emails", {
      method: "POST",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify(payload)
    });
  },
  update(context: ApiContext, id: string, payload: UpdateEmailPayload) {
    return apiFetch<Email>(`/emails/${id}`, {
      method: "PATCH",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify(payload)
    });
  },
  queue(context: ApiContext, id: string) {
    return apiFetch<Email>(`/emails/${id}/queue`, {
      method: "POST",
      token: context.token,
      companyId: context.companyId
    });
  },
  cancel(context: ApiContext, id: string) {
    return apiFetch<Email>(`/emails/${id}/cancel`, {
      method: "POST",
      token: context.token,
      companyId: context.companyId
    });
  },
  retry(context: ApiContext, id: string) {
    return apiFetch<Email>(`/emails/${id}/retry`, {
      method: "POST",
      token: context.token,
      companyId: context.companyId
    });
  },
  remove(context: ApiContext, id: string) {
    return apiFetch<{ success: true }>(`/emails/${id}`, {
      method: "DELETE",
      token: context.token,
      companyId: context.companyId
    });
  },
  templates(context: ApiContext) {
    return apiFetch<EmailTemplate[]>("/email-templates", {
      token: context.token,
      companyId: context.companyId
    });
  },
  createTemplate(context: ApiContext, payload: CreateEmailTemplatePayload) {
    return apiFetch<EmailTemplate>("/email-templates", {
      method: "POST",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify(payload)
    });
  },
  updateTemplate(context: ApiContext, id: string, payload: Partial<CreateEmailTemplatePayload>) {
    return apiFetch<EmailTemplate>(`/email-templates/${id}`, {
      method: "PATCH",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify(payload)
    });
  },
  removeTemplate(context: ApiContext, id: string) {
    return apiFetch<{ success: true }>(`/email-templates/${id}`, {
      method: "DELETE",
      token: context.token,
      companyId: context.companyId
    });
  },
  users(context: ApiContext) {
    return apiFetch<TaskUser[]>("/users", {
      token: context.token,
      companyId: context.companyId
    });
  }
};
