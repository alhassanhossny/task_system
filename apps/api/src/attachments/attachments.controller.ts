import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { RequestUser } from "../common/types/request-user";
import { AttachmentsService } from "./attachments.service";
import { CreateAttachmentDto } from "./dto/create-attachment.dto";
import { EntityReferenceDto } from "./dto/entity-reference.dto";

@ApiBearerAuth()
@ApiTags("attachments")
@Controller("attachments")
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @RequirePermissions(PERMISSIONS.attachmentsRead)
  @Get()
  findByEntity(@TenantId() tenantId: string, @Query() query: EntityReferenceDto) {
    return this.attachmentsService.findByEntity(tenantId, query.entityType, query.entityId);
  }

  @RequirePermissions(PERMISSIONS.attachmentsWrite)
  @Post()
  create(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Body() dto: CreateAttachmentDto) {
    return this.attachmentsService.create(tenantId, user.id, dto);
  }
}
