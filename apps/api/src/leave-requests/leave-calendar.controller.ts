import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { LeaveCalendarQueryDto } from "./dto/leave-calendar-query.dto";
import { LeaveRequestsService } from "./leave-requests.service";

@ApiBearerAuth()
@ApiTags("time-off calendar")
@Controller("calendar")
export class LeaveCalendarController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @RequirePermissions(PERMISSIONS.leaveRequestsRead)
  @Get("team")
  team(@TenantId() tenantId: string, @Query() query: LeaveCalendarQueryDto) {
    return this.leaveRequestsService.calendar(tenantId, query);
  }

  @RequirePermissions(PERMISSIONS.leaveRequestsRead)
  @Get("department/:id")
  department(@TenantId() tenantId: string, @Param("id") id: string, @Query() query: LeaveCalendarQueryDto) {
    return this.leaveRequestsService.calendar(tenantId, { ...query, departmentId: id });
  }
}
