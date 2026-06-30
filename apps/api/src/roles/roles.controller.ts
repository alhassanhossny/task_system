import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { RolesService } from "./roles.service";

@ApiBearerAuth()
@ApiTags("roles")
@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @RequirePermissions(PERMISSIONS.rolesRead)
  @Get("roles")
  findRoles(@TenantId() tenantId: string) {
    return this.rolesService.findRoles(tenantId);
  }

  @RequirePermissions(PERMISSIONS.rolesRead)
  @Get("permissions")
  findPermissions(@TenantId() tenantId: string) {
    return this.rolesService.findPermissions(tenantId);
  }
}
