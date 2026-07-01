import { Injectable } from "@nestjs/common";
import { CompanyStatus, SubscriptionStatus } from "@prisma/client";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { CreateTenantSwitchDto } from "./dto/create-tenant-switch.dto";
import { ListCompaniesDto } from "./dto/list-companies.dto";
import { ListSubscriptionsDto } from "./dto/list-subscriptions.dto";
import { PlatformAnalyticsQueryDto } from "./dto/platform-analytics-query.dto";
import { UpdateCompanyStatusDto } from "./dto/update-company-status.dto";
import { UpdatePlatformSettingDto } from "./dto/update-platform-setting.dto";
import { UpdateSubscriptionDto } from "./dto/update-subscription.dto";

type PlaceholderMeta = {
  placeholder: true;
  message: string;
};

type PlatformListResponse<T, Q = unknown> = {
  data: T[];
  meta: PlaceholderMeta & {
    page: number;
    limit: number;
    total: number;
    query?: Q;
  };
};

type PlatformItemResponse<T> = {
  data: T;
  meta: PlaceholderMeta;
};

type PlatformActionResponse = PlatformItemResponse<{
  id: string;
  accepted: boolean;
  requestedAt: string;
  input?: unknown;
}>;

type PlaceholderCompany = {
  id: string;
  name: string;
  status: CompanyStatus;
};

type PlaceholderSubscription = {
  id: string;
  companyId: string;
  planId: string;
  status: SubscriptionStatus;
};

@Injectable()
export class PlatformService {
  listCompanies(query: ListCompaniesDto): PlatformListResponse<PlaceholderCompany, ListCompaniesDto> {
    return this.list([], query);
  }

  getCompany(id: string): PlatformItemResponse<PlaceholderCompany> {
    return this.item({
      id,
      name: "Placeholder company",
      status: CompanyStatus.ACTIVE
    });
  }

  suspendCompany(id: string, dto: UpdateCompanyStatusDto): PlatformActionResponse {
    return this.action(id, { ...dto, targetStatus: CompanyStatus.SUSPENDED });
  }

  activateCompany(id: string, dto: UpdateCompanyStatusDto): PlatformActionResponse {
    return this.action(id, { ...dto, targetStatus: CompanyStatus.ACTIVE });
  }

  listPlans(): PlatformListResponse<{ id: string; code: string; name: string }> {
    return this.list([]);
  }

  listSubscriptions(query: ListSubscriptionsDto): PlatformListResponse<PlaceholderSubscription, ListSubscriptionsDto> {
    return this.list([], query);
  }

  createSubscription(dto: CreateSubscriptionDto): PlatformActionResponse {
    return this.action("pending-subscription-id", dto);
  }

  updateSubscription(id: string, dto: UpdateSubscriptionDto): PlatformActionResponse {
    return this.action(id, dto);
  }

  getPlatformOverview(query: PlatformAnalyticsQueryDto): PlatformItemResponse<{
    companies: number;
    activeSubscriptions: number;
    users: number;
    query: PlatformAnalyticsQueryDto;
  }> {
    return this.item({
      companies: 0,
      activeSubscriptions: 0,
      users: 0,
      query
    });
  }

  getUsageMetrics(query: PlatformAnalyticsQueryDto): PlatformListResponse<{ companyId: string; users: number; tasks: number }, PlatformAnalyticsQueryDto> {
    return this.list([], query);
  }

  listSettings(): PlatformListResponse<{ id: string; key: string; isSecret: boolean }> {
    return this.list([]);
  }

  updateSetting(id: string, dto: UpdatePlatformSettingDto): PlatformActionResponse {
    return this.action(id, dto);
  }

  createSwitchSession(dto: CreateTenantSwitchDto): PlatformActionResponse {
    return this.action("pending-switch-session-id", dto);
  }

  listSwitchSessions(): PlatformListResponse<{ id: string; companyId: string; status: string }> {
    return this.list([]);
  }

  private list<T, Q = unknown>(data: T[], query?: Q): PlatformListResponse<T, Q> {
    return {
      data,
      meta: {
        placeholder: true,
        message: "Platform backend skeleton only. Business logic will be implemented in a later Phase 4 step.",
        page: 1,
        limit: 25,
        total: data.length,
        query
      }
    };
  }

  private item<T>(data: T): PlatformItemResponse<T> {
    return {
      data,
      meta: {
        placeholder: true,
        message: "Platform backend skeleton only. Business logic will be implemented in a later Phase 4 step."
      }
    };
  }

  private action(id: string, input?: unknown): PlatformActionResponse {
    return this.item({
      id,
      accepted: true,
      requestedAt: new Date().toISOString(),
      input
    });
  }
}
