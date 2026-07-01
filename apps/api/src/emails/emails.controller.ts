import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { RequestUser } from "../common/types/request-user";
import { CreateEmailDto } from "./dto/create-email.dto";
import { EmailAttachmentDto } from "./dto/email-attachment.dto";
import { EmailQueryDto } from "./dto/email-query.dto";
import { UpdateEmailDto } from "./dto/update-email.dto";
import { EmailsService } from "./emails.service";

@ApiBearerAuth()
@ApiTags("emails")
@Controller("emails")
export class EmailsController {
  constructor(private readonly emailsService: EmailsService) {}

  @RequirePermissions(PERMISSIONS.emailsRead)
  @Get()
  findAll(@TenantId() tenantId: string, @Query() query: EmailQueryDto) {
    return this.emailsService.findAll(tenantId, query);
  }

  @RequirePermissions(PERMISSIONS.emailsRead)
  @Get(":id")
  findOne(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.emailsService.findOne(tenantId, id);
  }

  @RequirePermissions(PERMISSIONS.emailsCreate)
  @Post()
  create(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Body() dto: CreateEmailDto) {
    return this.emailsService.create(tenantId, user.id, dto);
  }

  @RequirePermissions(PERMISSIONS.emailsUpdate)
  @Patch(":id")
  update(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateEmailDto) {
    return this.emailsService.update(tenantId, user.id, id, dto);
  }

  @RequirePermissions(PERMISSIONS.emailsSend)
  @Post(":id/queue")
  queue(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.emailsService.queue(tenantId, user.id, id);
  }

  @RequirePermissions(PERMISSIONS.emailsSend)
  @Post(":id/cancel")
  cancel(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.emailsService.cancel(tenantId, user.id, id);
  }

  @RequirePermissions(PERMISSIONS.emailsSend)
  @Post(":id/retry")
  retry(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.emailsService.retry(tenantId, user.id, id);
  }

  @RequirePermissions(PERMISSIONS.emailsDelete)
  @Delete(":id")
  softDelete(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.emailsService.softDelete(tenantId, user.id, id);
  }

  @RequirePermissions(PERMISSIONS.emailsRead)
  @Get(":id/attachments")
  findAttachments(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.emailsService.findAttachments(tenantId, id);
  }

  @RequirePermissions(PERMISSIONS.attachmentsWrite)
  @Post(":id/attachments")
  addAttachment(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: EmailAttachmentDto) {
    return this.emailsService.addAttachment(tenantId, user.id, id, dto);
  }
}
