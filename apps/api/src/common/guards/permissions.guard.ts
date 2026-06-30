import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SystemRole } from "@prisma/client";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { RequestUser } from "../types/request-user";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: RequestUser }>();
    const user = request.user;

    if (user?.roles.includes(SystemRole.SUPER_ADMIN)) {
      return true;
    }

    const permissions = new Set(user?.permissions ?? []);
    return requiredPermissions.every((permission) => permissions.has(permission));
  }
}
