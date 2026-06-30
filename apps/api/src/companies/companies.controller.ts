import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SystemRole } from "@prisma/client";
import { PERMISSIONS } from "../common/constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { RequestUser } from "../common/types/request-user";
import { CompaniesService } from "./companies.service";
import { CreateCompanyDto } from "./dto/create-company.dto";

@ApiBearerAuth()
@ApiTags("companies")
@Controller("companies")
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @RequirePermissions(PERMISSIONS.companiesRead)
  @Get()
  findAll(@CurrentUser() user: RequestUser, @TenantId() tenantId: string) {
    return this.companiesService.findAll(user, tenantId);
  }

  @RequirePermissions(PERMISSIONS.companiesRead)
  @Get("current")
  current(@TenantId() tenantId: string) {
    return this.companiesService.findOne(tenantId);
  }

  @Roles(SystemRole.SUPER_ADMIN)
  @RequirePermissions(PERMISSIONS.companiesWrite)
  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @RequirePermissions(PERMISSIONS.companiesRead)
  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.companiesService.findOneForUser(user, id);
  }
}
