import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SystemRole } from "@prisma/client";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { TENANT_HEADER } from "../constants";
import { TenantRequest } from "../types/request-user";

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<TenantRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Authenticated user is required");
    }

    const headerValue = request.headers[TENANT_HEADER];
    const requestedCompanyId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const isSuperAdmin = user.roles.includes(SystemRole.SUPER_ADMIN);

    if (requestedCompanyId && requestedCompanyId !== user.companyId && !isSuperAdmin) {
      throw new ForbiddenException("Cannot access another company tenant");
    }

    request.companyId = requestedCompanyId && isSuperAdmin ? requestedCompanyId : user.companyId;
    return true;
  }
}
