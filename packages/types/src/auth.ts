export enum SystemRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  COMPANY_ADMIN = "COMPANY_ADMIN",
  MANAGER = "MANAGER",
  EMPLOYEE = "EMPLOYEE"
}

export interface AuthUser {
  id: string;
  companyId: string;
  email: string;
  name: string;
  locale: "ar" | "en";
  roles: SystemRole[];
  permissions: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
  companyId?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}
