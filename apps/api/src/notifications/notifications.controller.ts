import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { RequestUser } from "../common/types/request-user";
import { CreateNotificationDto } from "./dto/create-notification.dto";
import { NotificationsQueryDto } from "./dto/notifications-query.dto";
import { NotificationsService } from "./notifications.service";

@ApiBearerAuth()
@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @RequirePermissions(PERMISSIONS.notificationsRead)
  @Get()
  findMine(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Query() query: NotificationsQueryDto) {
    return this.notificationsService.findForUser(tenantId, user.id, {
      unreadOnly: query.unreadOnly === "true",
      limit: query.limit ? Number(query.limit) : 20
    });
  }

  @RequirePermissions(PERMISSIONS.notificationsWrite)
  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(tenantId, dto);
  }

  @RequirePermissions(PERMISSIONS.notificationsWrite)
  @Patch("read-all")
  markAllRead(@TenantId() tenantId: string, @CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllRead(tenantId, user.id);
  }

  @RequirePermissions(PERMISSIONS.notificationsWrite)
  @Patch(":id/read")
  markRead(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.notificationsService.markRead(tenantId, user.id, id);
  }
}
