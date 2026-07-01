import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PLATFORM_PERMISSIONS_KEY } from "../decorators/platform-permission.decorator";
import { RequestUser } from "../../../common/types/request-user";

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PLATFORM_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredPermissions?.length) {
      return true;
    }

    if (requiredPermissions.some((permission) => !permission.startsWith("platform:"))) {
      throw new ForbiddenException("PlatformAdminGuard only accepts platform permissions");
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const permissions = new Set(request.user?.permissions ?? []);
    const allowed = requiredPermissions.every((permission) => permissions.has(permission));

    if (!allowed) {
      throw new ForbiddenException("Platform permission is required");
    }

    return true;
  }
}
