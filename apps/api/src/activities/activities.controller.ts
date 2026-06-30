import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { ActivitiesService } from "./activities.service";

@ApiBearerAuth()
@ApiTags("activities")
@Controller("activities")
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @RequirePermissions(PERMISSIONS.activitiesRead)
  @ApiQuery({ name: "limit", required: false })
  @Get()
  findAll(@TenantId() tenantId: string, @Query("limit") limit?: string) {
    return this.activitiesService.findAll(tenantId, limit ? Number(limit) : 20);
  }
}
