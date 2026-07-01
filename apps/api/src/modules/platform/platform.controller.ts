import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "../../common/constants";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { RequestUser } from "../../common/types/request-user";
import { PlatformPermission } from "./decorators/platform-permission.decorator";
import { CreateSubscriptionPlanDto } from "./dto/create-subscription-plan.dto";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { CreateTenantSwitchDto } from "./dto/create-tenant-switch.dto";
import { GetCompanyDto } from "./dto/get-company.dto";
import { ListCompaniesDto } from "./dto/list-companies.dto";
import { ListPlansDto } from "./dto/list-plans.dto";
import { ListSubscriptionsDto } from "./dto/list-subscriptions.dto";
import { ListSwitchSessionsDto } from "./dto/list-switch-sessions.dto";
import { PlatformAnalyticsQueryDto } from "./dto/platform-analytics-query.dto";
import { UpdateCompanyStatusDto } from "./dto/update-company-status.dto";
import { UpdatePlatformSettingDto } from "./dto/update-platform-setting.dto";
import { UpdateSubscriptionDto } from "./dto/update-subscription.dto";
import { PlatformAdminGuard } from "./guards/platform-admin.guard";
import { PlatformService } from "./platform.service";

@ApiBearerAuth()
@ApiTags("Platform Administration")
@UseGuards(PlatformAdminGuard)
@Controller("platform")
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @PlatformPermission(PERMISSIONS.platformRead)
  @ApiOperation({ summary: "List tenant companies" })
  @Get("companies")
  listCompanies(@Query() query: ListCompaniesDto) {
    return this.platformService.listCompanies(query);
  }

  @PlatformPermission(PERMISSIONS.platformRead)
  @ApiOperation({ summary: "Get tenant company details" })
  @Get("companies/:id")
  getCompany(@Param() params: GetCompanyDto) {
    return this.platformService.getCompany(params.id);
  }

  @PlatformPermission(PERMISSIONS.platformManage)
  @ApiOperation({ summary: "Suspend a tenant company" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ type: UpdateCompanyStatusDto, required: false })
  @Post("companies/:id/suspend")
  suspendCompany(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateCompanyStatusDto) {
    return this.platformService.suspendCompany(id, user.id, dto ?? {});
  }

  @PlatformPermission(PERMISSIONS.platformManage)
  @ApiOperation({ summary: "Activate a tenant company" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ type: UpdateCompanyStatusDto, required: false })
  @Post("companies/:id/activate")
  activateCompany(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateCompanyStatusDto) {
    return this.platformService.activateCompany(id, user.id, dto ?? {});
  }

  @PlatformPermission(PERMISSIONS.platformRead)
  @RequirePermissions(PERMISSIONS.subscriptionsRead)
  @ApiOperation({ summary: "List company subscriptions" })
  @Get("subscriptions")
  listSubscriptions(@Query() query: ListSubscriptionsDto) {
    return this.platformService.listSubscriptions(query);
  }

  @PlatformPermission(PERMISSIONS.platformRead)
  @RequirePermissions(PERMISSIONS.subscriptionsRead)
  @ApiOperation({ summary: "List subscription plans" })
  @Get("plans")
  listPlans(@Query() query: ListPlansDto) {
    return this.platformService.listPlans(query);
  }

  @PlatformPermission(PERMISSIONS.platformManage)
  @RequirePermissions(PERMISSIONS.subscriptionsManage)
  @ApiOperation({ summary: "Create a subscription plan" })
  @Post("plans")
  createPlan(@CurrentUser() user: RequestUser, @Body() dto: CreateSubscriptionPlanDto) {
    return this.platformService.createPlan(user.companyId, user.id, dto);
  }

  @PlatformPermission(PERMISSIONS.platformManage)
  @RequirePermissions(PERMISSIONS.subscriptionsManage)
  @ApiOperation({ summary: "Create a company subscription" })
  @Post("subscriptions")
  createSubscription(@CurrentUser() user: RequestUser, @Body() dto: CreateSubscriptionDto) {
    return this.platformService.createSubscription(user.id, dto);
  }

  @PlatformPermission(PERMISSIONS.platformManage)
  @RequirePermissions(PERMISSIONS.subscriptionsManage)
  @ApiOperation({ summary: "Update a company subscription" })
  @ApiParam({ name: "id", format: "uuid" })
  @Patch("subscriptions/:id")
  updateSubscription(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.platformService.updateSubscription(id, user.id, dto);
  }

  @PlatformPermission(PERMISSIONS.platformRead)
  @RequirePermissions(PERMISSIONS.analyticsRead)
  @ApiOperation({ summary: "Get platform overview analytics" })
  @Get("analytics/overview")
  getPlatformOverview(@Query() query: PlatformAnalyticsQueryDto) {
    return this.platformService.getPlatformOverview(query);
  }

  @PlatformPermission(PERMISSIONS.platformRead)
  @RequirePermissions(PERMISSIONS.analyticsRead)
  @ApiOperation({ summary: "Get platform usage metrics" })
  @Get("analytics/usage")
  getUsageMetrics(@Query() query: PlatformAnalyticsQueryDto) {
    return this.platformService.getUsageMetrics(query);
  }

  @PlatformPermission(PERMISSIONS.platformRead)
  @RequirePermissions(PERMISSIONS.analyticsRead)
  @ApiOperation({ summary: "Get top companies by usage" })
  @Get("analytics/top-companies")
  getTopCompanies(@Query() query: PlatformAnalyticsQueryDto) {
    return this.platformService.getTopCompanies(query);
  }

  @PlatformPermission(PERMISSIONS.platformRead)
  @RequirePermissions(PERMISSIONS.analyticsRead)
  @ApiOperation({ summary: "Get active subscription distribution by plan" })
  @Get("analytics/subscription-distribution")
  getSubscriptionDistribution() {
    return this.platformService.getSubscriptionDistribution();
  }

  @PlatformPermission(PERMISSIONS.platformRead)
  @ApiOperation({ summary: "List platform settings placeholder" })
  @Get("settings")
  listSettings() {
    return this.platformService.listSettings();
  }

  @PlatformPermission(PERMISSIONS.platformManage)
  @ApiOperation({ summary: "Update a platform setting placeholder" })
  @ApiParam({ name: "id" })
  @Patch("settings/:id")
  updateSetting(@Param("id") id: string, @Body() dto: UpdatePlatformSettingDto) {
    return this.platformService.updateSetting(id, dto);
  }

  @PlatformPermission(PERMISSIONS.platformManage)
  @RequirePermissions(PERMISSIONS.tenantSwitchExecute)
  @ApiOperation({ summary: "End a tenant switch session" })
  @Post("switch-company/:sessionId/end")
  endSwitchSession(@CurrentUser() user: RequestUser, @Param("sessionId") sessionId: string) {
    return this.platformService.endSwitchSession(user.id, sessionId);
  }

  @PlatformPermission(PERMISSIONS.platformManage)
  @RequirePermissions(PERMISSIONS.tenantSwitchExecute)
  @ApiOperation({ summary: "Create a tenant switch session" })
  @Post("switch-company")
  createSwitchSession(@CurrentUser() user: RequestUser, @Body() dto: CreateTenantSwitchDto) {
    return this.platformService.createSwitchSession(user, dto);
  }

  @PlatformPermission(PERMISSIONS.platformRead)
  @RequirePermissions(PERMISSIONS.tenantSwitchExecute)
  @ApiOperation({ summary: "List tenant switch sessions" })
  @Get("switch-sessions")
  listSwitchSessions(@Query() query: ListSwitchSessionsDto) {
    return this.platformService.listSwitchSessions(query);
  }
}
