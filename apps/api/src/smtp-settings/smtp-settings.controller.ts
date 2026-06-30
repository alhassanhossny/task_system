import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { UpsertSmtpSettingDto } from "./dto/upsert-smtp-setting.dto";
import { SmtpSettingsService } from "./smtp-settings.service";

@ApiBearerAuth()
@ApiTags("smtp-settings")
@Controller("smtp-settings")
export class SmtpSettingsController {
  constructor(private readonly smtpSettingsService: SmtpSettingsService) {}

  @RequirePermissions(PERMISSIONS.smtpSettingsRead)
  @Get()
  findCurrent(@TenantId() tenantId: string) {
    return this.smtpSettingsService.findCurrent(tenantId);
  }

  @RequirePermissions(PERMISSIONS.smtpSettingsWrite)
  @Put()
  upsert(@TenantId() tenantId: string, @Body() dto: UpsertSmtpSettingDto) {
    return this.smtpSettingsService.upsert(tenantId, dto);
  }
}
