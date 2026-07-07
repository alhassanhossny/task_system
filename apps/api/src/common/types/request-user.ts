import { SystemRole } from "@prisma/client";

export interface RequestUser {
  id: string;
  companyId: string;
  originalCompanyId?: string | null;
  actingCompanyId?: string;
  switchSessionId?: string;
  platformAdmin?: boolean;
  email: string;
  roles: SystemRole[];
  permissions: string[];
}

export interface TenantRequest {
  user?: RequestUser;
  companyId?: string;
  headers: Record<string, string | string[] | undefined>;
}
