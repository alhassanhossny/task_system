import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { RequestUser } from "../common/types/request-user";
import { ApprovalDecisionDto } from "../leave-requests/dto/approval-action.dto";
import { TeamAvailabilityQueryDto } from "./dto/team-availability-query.dto";
import { TeamBalanceQueryDto } from "./dto/team-balance-query.dto";
import { TeamLeaveQueryDto } from "./dto/team-leave-query.dto";
import { TeamTaskQueryDto } from "./dto/team-task-query.dto";
import { TeamService } from "./team.service";

@ApiBearerAuth()
@ApiTags("team")
@Controller("team")
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @RequirePermissions(PERMISSIONS.usersViewTeam)
  @Get("members")
  members(@TenantId() tenantId: string, @CurrentUser() user: RequestUser) {
    return this.teamService.findMembers(tenantId, user.id);
  }

  @RequirePermissions(PERMISSIONS.usersViewTeam)
  @Get("member/:id")
  member(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.teamService.findMember(tenantId, user.id, id);
  }

  @RequirePermissions(PERMISSIONS.usersViewTeam, PERMISSIONS.leaveRequestsViewTeam, PERMISSIONS.tasksViewTeam)
  @Get("dashboard")
  dashboard(@TenantId() tenantId: string, @CurrentUser() user: RequestUser) {
    return this.teamService.dashboard(tenantId, user.id);
  }

  @RequirePermissions(PERMISSIONS.calendarViewTeam)
  @Get("availability")
  availability(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Query() query: TeamAvailabilityQueryDto) {
    return this.teamService.availability(tenantId, user.id, query);
  }

  @RequirePermissions(PERMISSIONS.leaveRequestsViewTeam)
  @Get("leave-requests")
  leaveRequests(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Query() query: TeamLeaveQueryDto) {
    return this.teamService.teamLeaveRequests(tenantId, user.id, query);
  }

  @RequirePermissions(PERMISSIONS.leaveRequestsViewTeam)
  @Get("pending-approvals")
  pendingApprovals(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Query() query: TeamLeaveQueryDto) {
    return this.teamService.pendingApprovals(tenantId, user.id, query);
  }

  @RequirePermissions(PERMISSIONS.leaveRequestsApproveTeam)
  @Post("leave-requests/:id/approve")
  approveLeave(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: ApprovalDecisionDto) {
    return this.teamService.approveTeamLeave(tenantId, user.id, id, dto);
  }

  @RequirePermissions(PERMISSIONS.leaveRequestsRejectTeam)
  @Post("leave-requests/:id/reject")
  rejectLeave(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: ApprovalDecisionDto) {
    return this.teamService.rejectTeamLeave(tenantId, user.id, id, dto);
  }

  @RequirePermissions(PERMISSIONS.usersViewTeam)
  @Get("leave-balances")
  leaveBalances(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Query() query: TeamBalanceQueryDto) {
    return this.teamService.teamLeaveBalances(tenantId, user.id, query);
  }

  @RequirePermissions(PERMISSIONS.tasksViewTeam)
  @Get("tasks")
  tasks(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Query() query: TeamTaskQueryDto) {
    return this.teamService.teamTasks(tenantId, user.id, query);
  }

  @RequirePermissions(PERMISSIONS.tasksViewTeam)
  @Get("tasks/overdue")
  overdueTasks(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Query() query: TeamTaskQueryDto) {
    return this.teamService.overdueTeamTasks(tenantId, user.id, query);
  }
}
