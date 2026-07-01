import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { RequestUser } from "../common/types/request-user";
import { LeaveBalanceQueryDto } from "./dto/leave-balance-query.dto";
import { UpdateLeaveBalanceDto } from "./dto/update-leave-balance.dto";
import { UpsertLeaveBalanceDto } from "./dto/upsert-leave-balance.dto";
import { LeaveBalancesService } from "./leave-balances.service";

@ApiBearerAuth()
@ApiTags("leave balances")
@Controller("leave-balances")
export class LeaveBalancesController {
  constructor(private readonly leaveBalancesService: LeaveBalancesService) {}

  @RequirePermissions(PERMISSIONS.leaveBalancesRead)
  @Get("me")
  findMine(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Query() query: LeaveBalanceQueryDto) {
    return this.leaveBalancesService.findMine(tenantId, user.id, query);
  }

  @RequirePermissions(PERMISSIONS.leaveBalancesRead)
  @Get()
  findAll(@TenantId() tenantId: string, @Query() query: LeaveBalanceQueryDto) {
    return this.leaveBalancesService.findAll(tenantId, query);
  }

  @RequirePermissions(PERMISSIONS.leaveBalancesWrite)
  @Post()
  upsert(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Body() dto: UpsertLeaveBalanceDto) {
    return this.leaveBalancesService.upsert(tenantId, user.id, dto);
  }

  @RequirePermissions(PERMISSIONS.leaveBalancesWrite)
  @Patch(":id")
  update(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateLeaveBalanceDto) {
    return this.leaveBalancesService.update(tenantId, user.id, id, dto);
  }
}
