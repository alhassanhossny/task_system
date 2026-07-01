import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SystemRole } from "@prisma/client";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { PLATFORM_PERMISSIONS_KEY, TENANT_HEADER } from "../constants";
import { TenantRequest } from "../types/request-user";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const effectiveCompanyId = requestedCompanyId && isSuperAdmin ? requestedCompanyId : user.companyId;
    request.companyId = effectiveCompanyId;

    const platformPermissions = this.reflector.getAllAndOverride<string[]>(PLATFORM_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (platformPermissions?.length) {
      return true;
    }

    const company = await this.prisma.company.findFirst({
      where: { id: effectiveCompanyId, deletedAt: null },
      select: { suspendedAt: true }
    });

    if (!company) {
      throw new ForbiddenException("Company tenant is not available");
    }

    if (company.suspendedAt) {
      throw new ForbiddenException("Company tenant is suspended");
    }

    return true;
  }
}
