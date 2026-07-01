import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { RequestUser } from "../common/types/request-user";
import { ApprovalDecisionDto } from "./dto/approval-action.dto";
import { CreateLeaveAttachmentDto } from "./dto/create-leave-attachment.dto";
import { CreateLeaveCommentDto } from "./dto/create-leave-comment.dto";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { CreateLeaveTypeDto } from "./dto/create-leave-type.dto";
import { LeaveCalendarQueryDto } from "./dto/leave-calendar-query.dto";
import { LeaveQueryDto } from "./dto/leave-query.dto";
import { UpdateLeaveSettingsDto } from "./dto/update-leave-settings.dto";
import { UpdateLeaveRequestDto } from "./dto/update-leave-request.dto";
import { UpdateLeaveTypeDto } from "./dto/update-leave-type.dto";
import { LeaveRequestsService } from "./leave-requests.service";

@ApiBearerAuth()
@ApiTags("leave requests")
@Controller()
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @RequirePermissions(PERMISSIONS.leaveTypesRead)
  @Get("leave-types")
  findTypes(@TenantId() tenantId: string) {
    return this.leaveRequestsService.findTypes(tenantId);
  }

  @RequirePermissions(PERMISSIONS.leaveTypesWrite)
  @Post("leave-types")
  createType(@TenantId() tenantId: string, @Body() dto: CreateLeaveTypeDto) {
    return this.leaveRequestsService.createType(tenantId, dto);
  }

  @RequirePermissions(PERMISSIONS.leaveTypesWrite)
  @Patch("leave-types/:id")
  updateType(@TenantId() tenantId: string, @Param("id") id: string, @Body() dto: UpdateLeaveTypeDto) {
    return this.leaveRequestsService.updateType(tenantId, id, dto);
  }

  @RequirePermissions(PERMISSIONS.leaveSettingsRead)
  @Get("leave-settings")
  findSettings(@TenantId() tenantId: string) {
    return this.leaveRequestsService.findSettings(tenantId);
  }

  @RequirePermissions(PERMISSIONS.leaveSettingsWrite)
  @Patch("leave-settings")
  updateSettings(@TenantId() tenantId: string, @Body() dto: UpdateLeaveSettingsDto) {
    return this.leaveRequestsService.updateSettings(tenantId, dto);
  }

  @RequirePermissions(PERMISSIONS.leaveRequestsRead)
  @Get("leave-requests")
  findAll(@TenantId() tenantId: string, @Query() query: LeaveQueryDto) {
    return this.leaveRequestsService.findAll(tenantId, query);
  }

  @RequirePermissions(PERMISSIONS.leaveRequestsRead)
  @Get("leave-requests/calendar")
  calendar(@TenantId() tenantId: string, @Query() query: LeaveCalendarQueryDto) {
    return this.leaveRequestsService.calendar(tenantId, query);
  }

  @RequirePermissions(PERMISSIONS.leaveRequestsRead)
  @Get("leave-requests/availability")
  availability(@TenantId() tenantId: string, @Query() query: LeaveCalendarQueryDto) {
    return this.leaveRequestsService.availability(tenantId, query);
  }

  @RequirePermissions(PERMISSIONS.leaveRequestsRead)
  @Get("leave-requests/:id")
  findOne(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.leaveRequestsService.findOne(tenantId, id);
  }

  @RequirePermissions(PERMISSIONS.leaveRequestsRead)
  @Get("leave-requests/:id/history")
  history(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.leaveRequestsService.history(tenantId, id);
  }

  @RequirePermissions(PERMISSIONS.leaveRequestsSubmit)
  @Post("leave-requests")
  create(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Body() dto: CreateLeaveRequestDto) {
    return this.leaveRequestsService.create(tenantId, user.id, dto);
  }

  @RequirePermissions(PERMISSIONS.leaveRequestsUpdate)
  @Patch("leave-requests/:id")
  update(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateLeaveRequestDto) {
    return this.leaveRequestsService.update(tenantId, user.id, id, dto);
  }

  @RequirePermissions(PERMISSIONS.leaveRequestsApprove)
  @Post("leave-requests/:id/approve")
  approve(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: ApprovalDecisionDto) {
    return this.leaveRequestsService.approve(tenantId, user.id, id, dto);
  }

  @RequirePermissions(PERMISSIONS.leaveRequestsReject)
  @Post("leave-requests/:id/reject")
  reject(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: ApprovalDecisionDto) {
    return this.leaveRequestsService.reject(tenantId, user.id, id, dto);
  }

  @RequirePermissions(PERMISSIONS.leaveRequestsApprove)
  @Post("leave-requests/:id/request-info")
  requestMoreInformation(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: ApprovalDecisionDto) {
    return this.leaveRequestsService.requestMoreInformation(tenantId, user.id, id, dto);
  }

  @RequirePermissions(PERMISSIONS.leaveRequestsCancel)
  @Post("leave-requests/:id/cancel")
  cancel(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: ApprovalDecisionDto) {
    return this.leaveRequestsService.cancel(tenantId, user.id, id, dto);
  }

  @RequirePermissions(PERMISSIONS.leaveRequestsRead)
  @Get("leave-requests/:id/comments")
  findComments(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.leaveRequestsService.findComments(tenantId, id);
  }

  @RequirePermissions(PERMISSIONS.commentsWrite)
  @Post("leave-requests/:id/comments")
  addComment(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: CreateLeaveCommentDto) {
    return this.leaveRequestsService.addComment(tenantId, user.id, id, dto);
  }

  @RequirePermissions(PERMISSIONS.leaveRequestsRead)
  @Get("leave-requests/:id/attachments")
  findAttachments(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.leaveRequestsService.findAttachments(tenantId, id);
  }

  @RequirePermissions(PERMISSIONS.attachmentsWrite)
  @Post("leave-requests/:id/attachments")
  addAttachment(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: CreateLeaveAttachmentDto) {
    return this.leaveRequestsService.addAttachment(tenantId, user.id, id, dto);
  }
}
