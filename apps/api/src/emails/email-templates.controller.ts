import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { RequestUser } from "../common/types/request-user";
import { CreateEmailTemplateDto } from "./dto/create-email-template.dto";
import { UpdateEmailTemplateDto } from "./dto/update-email-template.dto";
import { EmailTemplatesService } from "./email-templates.service";

@ApiBearerAuth()
@ApiTags("email templates")
@Controller("email-templates")
export class EmailTemplatesController {
  constructor(private readonly templatesService: EmailTemplatesService) {}

  @RequirePermissions(PERMISSIONS.emailTemplatesRead)
  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.templatesService.findAll(tenantId);
  }

  @RequirePermissions(PERMISSIONS.emailTemplatesWrite)
  @Post()
  create(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Body() dto: CreateEmailTemplateDto) {
    return this.templatesService.create(tenantId, user.id, dto);
  }

  @RequirePermissions(PERMISSIONS.emailTemplatesWrite)
  @Patch(":id")
  update(@TenantId() tenantId: string, @Param("id") id: string, @Body() dto: UpdateEmailTemplateDto) {
    return this.templatesService.update(tenantId, id, dto);
  }

  @RequirePermissions(PERMISSIONS.emailTemplatesWrite)
  @Delete(":id")
  remove(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.templatesService.remove(tenantId, id);
  }
}
