import { Injectable, NotFoundException } from "@nestjs/common";
import { CompanyPlan, CompanyStatus, EntityType, Prisma, SubscriptionStatus } from "@prisma/client";
import { DomainEventBus } from "../../domain-events/domain-event-bus.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { CreateTenantSwitchDto } from "./dto/create-tenant-switch.dto";
import { ListCompaniesDto } from "./dto/list-companies.dto";
import { ListSubscriptionsDto } from "./dto/list-subscriptions.dto";
import { PlatformAnalyticsQueryDto } from "./dto/platform-analytics-query.dto";
import { UpdateCompanyStatusDto } from "./dto/update-company-status.dto";
import { UpdatePlatformSettingDto } from "./dto/update-platform-setting.dto";
import { UpdateSubscriptionDto } from "./dto/update-subscription.dto";
import { PLATFORM_EVENTS } from "./platform.events";

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

type CompanySummary = {
  id: string;
  name: string;
  slug: string;
  plan: CompanyPlan;
  status: CompanyStatus;
  primaryDomain: string | null;
  billingEmail: string | null;
  supportEmail: string | null;
  timezone: string;
  trialEndsAt: Date | null;
  suspendedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CompanyListItem = CompanySummary & {
  usersCount: number;
};

type CompanySubscriptionDetail = Prisma.CompanySubscriptionGetPayload<{ include: { plan: true } }> | null;

type CompanyDetail = {
  company: CompanySummary;
  subscription: CompanySubscriptionDetail;
  usersCount: number;
  departmentsCount: number;
  tasksCount: number;
  storageUsage: number;
  lastActivityAt: Date | null;
};

type PlaceholderSubscription = {
  id: string;
  companyId: string;
  planId: string;
  status: SubscriptionStatus;
};

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus
  ) {}

  async listCompanies(query: ListCompaniesDto): Promise<{
    data: CompanyListItem[];
    meta: { page: number; limit: number; total: number; query: ListCompaniesDto };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.plan ? { plan: query.plan } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { primaryDomain: { contains: query.search, mode: "insensitive" as const } },
              { billingEmail: { contains: query.search, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const [total, companies] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          ...this.companySelect(),
          _count: {
            select: {
              users: { where: { deletedAt: null } }
            }
          }
        }
      })
    ]);

    return {
      data: companies.map((company) => ({
        ...this.serializeCompany(company),
        usersCount: company._count.users
      })),
      meta: {
        page,
        limit,
        total,
        query
      }
    };
  }

  async getCompany(id: string): Promise<CompanyDetail> {
    const company = await this.findCompany(id);
    const [subscription, usersCount, departmentsCount, tasksCount, storageUsage, lastActivity] = await Promise.all([
      this.latestSubscription(id),
      this.prisma.user.count({ where: { companyId: id, deletedAt: null } }),
      this.prisma.department.count({ where: { companyId: id, deletedAt: null } }),
      this.prisma.task.count({ where: { companyId: id, deletedAt: null } }),
      this.prisma.attachment.aggregate({ where: { companyId: id, deletedAt: null }, _sum: { fileSize: true } }),
      this.prisma.activity.findFirst({
        where: { companyId: id, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true }
      })
    ]);

    return {
      company,
      subscription,
      usersCount,
      departmentsCount,
      tasksCount,
      storageUsage: storageUsage._sum.fileSize ?? 0,
      lastActivityAt: lastActivity?.createdAt ?? null
    };
  }

  async suspendCompany(id: string, actorId: string, dto: UpdateCompanyStatusDto): Promise<CompanySummary> {
    await this.findCompany(id);
    const suspendedAt = new Date();
    const company = await this.prisma.company.update({
      where: { id },
      data: {
        status: CompanyStatus.SUSPENDED,
        suspendedAt
      },
      select: this.companySelect()
    });

    await this.recordCompanyAction(id, actorId, "COMPANY_SUSPENDED", PLATFORM_EVENTS.companySuspended, {
      reason: dto.reason ?? null,
      suspendedAt: suspendedAt.toISOString()
    });

    return this.serializeCompany(company);
  }

  async activateCompany(id: string, actorId: string, dto: UpdateCompanyStatusDto): Promise<CompanySummary> {
    await this.findCompany(id);
    const company = await this.prisma.company.update({
      where: { id },
      data: {
        status: CompanyStatus.ACTIVE,
        suspendedAt: null
      },
      select: this.companySelect()
    });

    await this.recordCompanyAction(id, actorId, "COMPANY_ACTIVATED", PLATFORM_EVENTS.companyActivated, {
      reason: dto.reason ?? null,
      activatedAt: new Date().toISOString()
    });

    return this.serializeCompany(company);
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

  private companySelect() {
    return {
      id: true,
      name: true,
      slug: true,
      plan: true,
      status: true,
      primaryDomain: true,
      billingEmail: true,
      supportEmail: true,
      timezone: true,
      trialEndsAt: true,
      suspendedAt: true,
      createdAt: true,
      updatedAt: true
    } as const;
  }

  private async findCompany(id: string): Promise<CompanySummary> {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
      select: this.companySelect()
    });

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    return this.serializeCompany(company);
  }

  private serializeCompany(company: CompanySummary): CompanySummary {
    return company;
  }

  private latestSubscription(companyId: string) {
    return this.prisma.companySubscription.findFirst({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        plan: true
      }
    });
  }

  private async recordCompanyAction(
    companyId: string,
    actorId: string,
    action: "COMPANY_SUSPENDED" | "COMPANY_ACTIVATED",
    eventName: string,
    metadata: Prisma.InputJsonObject
  ) {
    await this.prisma.auditLog.create({
      data: {
        companyId,
        actorId,
        action,
        entityType: EntityType.COMPANY,
        entityId: companyId,
        metadata
      }
    });

    this.eventBus.publish({
      name: eventName,
      companyId,
      actorId,
      entityType: EntityType.COMPANY,
      entityId: companyId,
      payload: metadata
    });
  }
}
