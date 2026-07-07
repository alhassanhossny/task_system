import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { RequestUser } from "../common/types/request-user";
import { CreateSavedFilterDto } from "./dto/create-saved-filter.dto";
import { SavedFilterQueryDto } from "./dto/saved-filter-query.dto";
import { UpdateSavedFilterDto } from "./dto/update-saved-filter.dto";
import { SavedFiltersService } from "./saved-filters.service";

@ApiBearerAuth()
@ApiTags("saved filters")
@Controller("saved-filters")
export class SavedFiltersController {
  constructor(private readonly savedFiltersService: SavedFiltersService) {}

  @RequirePermissions(PERMISSIONS.savedFiltersRead)
  @Get()
  findAll(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Query() query: SavedFilterQueryDto) {
    return this.savedFiltersService.findAll(tenantId, user.id, query);
  }

  @RequirePermissions(PERMISSIONS.savedFiltersWrite)
  @Post()
  create(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Body() dto: CreateSavedFilterDto) {
    return this.savedFiltersService.create(tenantId, user.id, dto);
  }

  @RequirePermissions(PERMISSIONS.savedFiltersWrite)
  @Patch(":id")
  update(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateSavedFilterDto) {
    return this.savedFiltersService.update(tenantId, user.id, id, dto);
  }

  @RequirePermissions(PERMISSIONS.savedFiltersWrite)
  @Delete(":id")
  remove(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.savedFiltersService.remove(tenantId, user.id, id);
  }
}
