import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../common/constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { TenantId } from "../common/decorators/tenant-id.decorator";
import { RequestUser } from "../common/types/request-user";
import { SearchQueryDto } from "./dto/search-query.dto";
import { SearchService } from "./search.service";

@ApiBearerAuth()
@ApiTags("search")
@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @RequirePermissions(PERMISSIONS.searchRead)
  @Get()
  search(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Query() query: SearchQueryDto) {
    return this.searchService.search(tenantId, user, query);
  }

  @RequirePermissions(PERMISSIONS.searchRead)
  @Get("recent")
  recent(@TenantId() tenantId: string, @CurrentUser() user: RequestUser) {
    return this.searchService.recent(tenantId, user.id);
  }
}
