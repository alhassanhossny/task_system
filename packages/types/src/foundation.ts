export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Company extends BaseEntity {
  name: string;
  slug: string;
  plan: "starter" | "professional" | "enterprise";
  status: "active" | "trial" | "suspended";
  defaultLocale: "ar" | "en";
}

export interface Department extends BaseEntity {
  companyId: string;
  name: string;
  code: string;
  managerId: string | null;
}

export interface User extends BaseEntity {
  companyId: string;
  departmentId: string | null;
  email: string;
  name: string;
  jobTitle: string | null;
  locale: "ar" | "en";
  status: "active" | "inactive" | "invited" | "suspended";
}

export interface Role extends BaseEntity {
  companyId: string;
  name: string;
  systemName: string;
  description: string | null;
}

export interface Permission extends BaseEntity {
  companyId: string;
  action: string;
  subject: string;
  description: string | null;
}

export interface Activity extends BaseEntity {
  companyId: string;
  actorId: string | null;
  type: string;
  title: string;
  metadata: Record<string, unknown>;
}

export interface AuditLog extends BaseEntity {
  companyId: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
}
