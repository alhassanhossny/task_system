import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { DepartmentsService } from "./departments.service";

@ApiBearerAuth()
@ApiTags("departments")
@Controller("departments")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @RequirePermissions(PERMISSIONS.departmentsRead)
  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.departmentsService.findAll(tenantId);
  }

  @RequirePermissions(PERMISSIONS.departmentsWrite)
  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(tenantId, dto);
  }
}
