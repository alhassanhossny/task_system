import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { RequestUser } from "../common/types/request-user";
import { CreateUserDto } from "./dto/create-user.dto";
import { UsersService } from "./users.service";

@ApiBearerAuth()
@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @RequirePermissions(PERMISSIONS.usersRead)
  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.usersService.findAll(tenantId);
  }

  @RequirePermissions(PERMISSIONS.usersRead)
  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return this.usersService.findOne(user.companyId, user.id);
  }

  @RequirePermissions(PERMISSIONS.usersRead)
  @Get(":id")
  findOne(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.usersService.findOne(tenantId, id);
  }

  @RequirePermissions(PERMISSIONS.usersWrite)
  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateUserDto) {
    return this.usersService.create(tenantId, dto);
  }
}
