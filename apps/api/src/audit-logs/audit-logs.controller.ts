import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { AuditLogsService } from "./audit-logs.service";

@ApiBearerAuth()
@ApiTags("audit-logs")
@Controller("audit-logs")
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @RequirePermissions(PERMISSIONS.auditRead)
  @ApiQuery({ name: "limit", required: false })
  @Get()
  findAll(@TenantId() tenantId: string, @Query("limit") limit?: string) {
    return this.auditLogsService.findAll(tenantId, limit ? Number(limit) : 50);
  }
}
