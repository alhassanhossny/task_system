import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { RequestUser } from "../common/types/request-user";
import { AssignTaskDto } from "./dto/assign-task.dto";
import { CreateTaskAttachmentDto } from "./dto/create-task-attachment.dto";
import { CreateTaskCommentDto } from "./dto/create-task-comment.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { TaskQueryDto } from "./dto/task-query.dto";
import { UpdateTaskStatusDto } from "./dto/update-task-status.dto";
import { UpdateTaskWatchersDto } from "./dto/update-task-watchers.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TasksService } from "./tasks.service";

@ApiBearerAuth()
@ApiTags("tasks")
@Controller("tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @RequirePermissions(PERMISSIONS.tasksRead)
  @Get()
  findAll(@TenantId() tenantId: string, @Query() query: TaskQueryDto) {
    return this.tasksService.findAll(tenantId, query);
  }

  @RequirePermissions(PERMISSIONS.tasksRead)
  @Get(":id")
  findOne(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.tasksService.findOne(tenantId, id);
  }

  @RequirePermissions(PERMISSIONS.tasksCreate)
  @Post()
  create(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(tenantId, user.id, dto);
  }

  @RequirePermissions(PERMISSIONS.tasksUpdate)
  @Patch(":id")
  update(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(tenantId, user.id, id, dto);
  }

  @RequirePermissions(PERMISSIONS.tasksAssign)
  @Patch(":id/assignees")
  assign(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: AssignTaskDto) {
    return this.tasksService.assign(tenantId, user.id, id, dto);
  }

  @RequirePermissions(PERMISSIONS.tasksAssign)
  @Patch(":id/watchers")
  updateWatchers(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateTaskWatchersDto) {
    return this.tasksService.updateWatchers(tenantId, user.id, id, dto);
  }

  @RequirePermissions(PERMISSIONS.tasksComplete)
  @Patch(":id/status")
  updateStatus(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateTaskStatusDto) {
    return this.tasksService.updateStatus(tenantId, user.id, id, dto);
  }

  @RequirePermissions(PERMISSIONS.tasksDelete)
  @Delete(":id")
  softDelete(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.tasksService.softDelete(tenantId, user.id, id);
  }

  @RequirePermissions(PERMISSIONS.tasksRead)
  @Get(":id/comments")
  findComments(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.tasksService.findComments(tenantId, id);
  }

  @RequirePermissions(PERMISSIONS.tasksComment)
  @Post(":id/comments")
  addComment(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: CreateTaskCommentDto) {
    return this.tasksService.addComment(tenantId, user.id, id, dto);
  }

  @RequirePermissions(PERMISSIONS.tasksRead)
  @Get(":id/attachments")
  findAttachments(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.tasksService.findAttachments(tenantId, id);
  }

  @RequirePermissions(PERMISSIONS.tasksAttach)
  @Post(":id/attachments")
  addAttachment(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: CreateTaskAttachmentDto) {
    return this.tasksService.addAttachment(tenantId, user.id, id, dto);
  }
}
