import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { BillingInterval, CompanyPlan, CompanyStatus, CompanySwitchStatus, EntityType, Prisma, SubscriptionStatus } from "@prisma/client";
import { RequestUser } from "../../common/types/request-user";
import { DomainEventBus } from "../../domain-events/domain-event-bus.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSubscriptionPlanDto } from "./dto/create-subscription-plan.dto";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { CreateTenantSwitchDto } from "./dto/create-tenant-switch.dto";
import { ListCompaniesDto } from "./dto/list-companies.dto";
import { ListPlansDto } from "./dto/list-plans.dto";
import { ListSubscriptionsDto } from "./dto/list-subscriptions.dto";
import { ListSwitchSessionsDto } from "./dto/list-switch-sessions.dto";
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

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
    private readonly jwt: JwtService
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

  async listPlans(query: ListPlansDto): Promise<{
    data: Prisma.SubscriptionPlanGetPayload<Record<string, never>>[];
    meta: { page: number; limit: number; total: number; query: ListPlansDto };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where = {
      deletedAt: null,
      ...(query.tier ? { tier: query.tier } : {}),
      ...(typeof query.isActive === "boolean" ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: "insensitive" as const } },
              { name: { contains: query.search, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const [total, plans] = await Promise.all([
      this.prisma.subscriptionPlan.count({ where }),
      this.prisma.subscriptionPlan.findMany({
        where,
        orderBy: [{ tier: "asc" }, { monthlyPrice: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return {
      data: plans,
      meta: {
        page,
        limit,
        total,
        query
      }
    };
  }

  async createPlan(actorCompanyId: string, actorId: string, dto: CreateSubscriptionPlanDto) {
    const code = this.normalizePlanCode(dto.code);
    const existing = await this.prisma.subscriptionPlan.findFirst({
      where: { code, deletedAt: null },
      select: { id: true }
    });

    if (existing) {
      throw new ConflictException("Subscription plan code already exists");
    }

    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        code,
        name: dto.name,
        description: dto.description,
        tier: dto.tier ?? CompanyPlan.STARTER,
        monthlyPrice: dto.monthlyPrice ?? 0,
        yearlyPrice: dto.yearlyPrice ?? 0,
        currency: dto.currency?.toUpperCase() ?? "USD",
        maxUsers: dto.maxUsers,
        maxStorageMb: dto.maxStorageMb,
        maxCompanies: dto.maxCompanies,
        features: this.jsonObject(dto.features),
        isActive: dto.isActive ?? true
      }
    });

    await this.prisma.auditLog.create({
      data: {
        companyId: actorCompanyId,
        actorId,
        action: "SUBSCRIPTION_PLAN_CREATED",
        entityType: "SUBSCRIPTION_PLAN",
        entityId: plan.id,
        metadata: {
          code: plan.code,
          tier: plan.tier
        }
      }
    });

    return plan;
  }

  async listSubscriptions(query: ListSubscriptionsDto): Promise<{
    data: Array<Prisma.CompanySubscriptionGetPayload<{ include: ReturnType<PlatformService["subscriptionInclude"]> }>>;
    meta: { page: number; limit: number; total: number; query: ListSubscriptionsDto };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where = {
      deletedAt: null,
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.planId ? { planId: query.planId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.billingInterval ? { billingInterval: query.billingInterval } : {})
    };

    const [total, subscriptions] = await Promise.all([
      this.prisma.companySubscription.count({ where }),
      this.prisma.companySubscription.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: this.subscriptionInclude()
      })
    ]);

    return {
      data: subscriptions,
      meta: {
        page,
        limit,
        total,
        query
      }
    };
  }

  async createSubscription(actorId: string, dto: CreateSubscriptionDto) {
    await this.findCompany(dto.companyId);
    const plan = await this.findActivePlan(dto.planId);
    const startsAt = this.dateOrNow(dto.startsAt);
    const trialEndsAt = this.optionalDate(dto.trialEndsAt);
    const currentPeriodEnd = this.optionalDate(dto.currentPeriodEnd);
    const status = dto.status ?? SubscriptionStatus.TRIALING;
    const billingInterval = dto.billingInterval ?? BillingInterval.MONTHLY;

    const subscription = await this.prisma.companySubscription.create({
      data: {
        companyId: dto.companyId,
        planId: plan.id,
        status,
        billingInterval,
        seats: dto.seats ?? 1,
        startsAt,
        trialEndsAt,
        currentPeriodStart: startsAt,
        currentPeriodEnd,
        metadata: this.jsonObject(dto.metadata)
      },
      include: this.subscriptionInclude()
    });

    await this.prisma.company.update({
      where: { id: dto.companyId },
      data: {
        plan: plan.tier,
        ...(trialEndsAt ? { trialEndsAt } : {})
      }
    });

    await this.recordSubscriptionAction(dto.companyId, actorId, "SUBSCRIPTION_CREATED", PLATFORM_EVENTS.subscriptionCreated, subscription.id, {
      planId: plan.id,
      status,
      billingInterval,
      seats: subscription.seats
    });

    return subscription;
  }

  async updateSubscription(id: string, actorId: string, dto: UpdateSubscriptionDto) {
    const existing = await this.prisma.companySubscription.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, companyId: true }
    });

    if (!existing) {
      throw new NotFoundException("Subscription not found");
    }

    const plan = dto.planId ? await this.findActivePlan(dto.planId) : null;
    const data: Prisma.CompanySubscriptionUncheckedUpdateInput = {
      ...(plan ? { planId: plan.id } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.billingInterval ? { billingInterval: dto.billingInterval } : {}),
      ...(dto.seats ? { seats: dto.seats } : {}),
      ...(dto.currentPeriodEnd ? { currentPeriodEnd: this.optionalDate(dto.currentPeriodEnd) } : {}),
      ...(dto.cancelledAt ? { cancelledAt: this.optionalDate(dto.cancelledAt) } : {}),
      ...(dto.status === SubscriptionStatus.CANCELLED && !dto.cancelledAt ? { cancelledAt: new Date() } : {}),
      ...(dto.metadata ? { metadata: this.jsonObject(dto.metadata) } : {})
    };

    const subscription = await this.prisma.companySubscription.update({
      where: { id },
      data,
      include: this.subscriptionInclude()
    });

    if (plan) {
      await this.prisma.company.update({
        where: { id: existing.companyId },
        data: { plan: plan.tier }
      });
    }

    await this.recordSubscriptionAction(existing.companyId, actorId, "SUBSCRIPTION_UPDATED", PLATFORM_EVENTS.subscriptionUpdated, subscription.id, {
      planId: subscription.planId,
      status: subscription.status,
      billingInterval: subscription.billingInterval,
      seats: subscription.seats
    });

    return subscription;
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

  async createSwitchSession(actor: RequestUser, dto: CreateTenantSwitchDto) {
    const targetCompany = await this.findCompany(dto.companyId);

    if (targetCompany.suspendedAt || targetCompany.status === CompanyStatus.SUSPENDED) {
      throw new ConflictException("Cannot switch into a suspended company");
    }

    await this.expireSwitchSessions();

    const actorCompanyId = actor.originalCompanyId ?? actor.companyId;
    const overlapping = await this.prisma.companySwitchSession.findFirst({
      where: {
        companyId: dto.companyId,
        actorUserId: actor.id,
        status: CompanySwitchStatus.ACTIVE,
        endedAt: null,
        revokedAt: null,
        deletedAt: null
      },
      select: { id: true }
    });

    if (overlapping) {
      throw new ConflictException("An active switch session already exists for this admin and company");
    }

    const expiresAt = this.switchExpiresAt(dto.expiresAt);
    const session = await this.prisma.companySwitchSession.create({
      data: {
        companyId: dto.companyId,
        actorCompanyId,
        actorUserId: actor.id,
        status: CompanySwitchStatus.ACTIVE,
        reason: dto.reason,
        expiresAt,
        metadata: this.jsonObject(dto.metadata)
      },
      include: this.switchSessionInclude()
    });

    await this.recordSwitchAction(dto.companyId, actor.id, "COMPANY_SWITCH_STARTED", PLATFORM_EVENTS.switchCreated, session.id, {
      reason: dto.reason ?? null,
      actorCompanyId,
      expiresAt: expiresAt.toISOString()
    });

    const token = await this.signSwitchToken(actor, session.id, dto.companyId, actorCompanyId, expiresAt);

    return {
      sessionId: session.id,
      companyId: session.companyId,
      token,
      expiresAt: session.expiresAt,
      status: session.status,
      session
    };
  }

  async listSwitchSessions(query: ListSwitchSessionsDto): Promise<{
    data: Array<Prisma.CompanySwitchSessionGetPayload<{ include: ReturnType<PlatformService["switchSessionInclude"]> }>>;
    meta: { page: number; limit: number; total: number; query: ListSwitchSessionsDto };
  }> {
    await this.expireSwitchSessions();
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {})
    };
    const [total, sessions] = await Promise.all([
      this.prisma.companySwitchSession.count({ where }),
      this.prisma.companySwitchSession.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: this.switchSessionInclude()
      })
    ]);

    return {
      data: sessions,
      meta: {
        page,
        limit,
        total,
        query
      }
    };
  }

  async endSwitchSession(actorId: string, sessionId: string) {
    await this.expireSwitchSessions();
    const existing = await this.prisma.companySwitchSession.findFirst({
      where: {
        id: sessionId,
        actorUserId: actorId,
        deletedAt: null
      },
      include: this.switchSessionInclude()
    });

    if (!existing) {
      throw new NotFoundException("Switch session not found");
    }

    if (existing.status !== CompanySwitchStatus.ACTIVE || existing.endedAt || existing.revokedAt) {
      throw new ConflictException("Switch session is not active");
    }

    const endedAt = new Date();
    const session = await this.prisma.companySwitchSession.update({
      where: { id: sessionId },
      data: {
        status: CompanySwitchStatus.ENDED,
        endedAt
      },
      include: this.switchSessionInclude()
    });

    await this.recordSwitchAction(session.companyId, actorId, "COMPANY_SWITCH_ENDED", PLATFORM_EVENTS.switchEnded, session.id, {
      endedAt: endedAt.toISOString()
    });

    return session;
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

  private subscriptionInclude() {
    return {
      company: {
        select: this.companySelect()
      },
      plan: true,
      _count: {
        select: {
          invoices: true
        }
      }
    } as const;
  }

  private async findActivePlan(id: string) {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { id, isActive: true, deletedAt: null }
    });

    if (!plan) {
      throw new NotFoundException("Subscription plan not found");
    }

    return plan;
  }

  private switchSessionInclude() {
    return {
      targetCompany: {
        select: this.companySelect()
      },
      actorCompany: {
        select: this.companySelect()
      },
      actorUser: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    } as const;
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

  private async recordSubscriptionAction(
    companyId: string,
    actorId: string,
    action: "SUBSCRIPTION_CREATED" | "SUBSCRIPTION_UPDATED",
    eventName: string,
    subscriptionId: string,
    metadata: Prisma.InputJsonObject
  ) {
    await this.prisma.auditLog.create({
      data: {
        companyId,
        actorId,
        action,
        entityType: "SUBSCRIPTION",
        entityId: subscriptionId,
        metadata
      }
    });

    this.eventBus.publish({
      name: eventName,
      companyId,
      actorId,
      entityId: subscriptionId,
      payload: metadata
    });
  }

  private async recordSwitchAction(
    companyId: string,
    actorId: string,
    action: "COMPANY_SWITCH_STARTED" | "COMPANY_SWITCH_ENDED",
    eventName: string,
    sessionId: string,
    metadata: Prisma.InputJsonObject
  ) {
    await this.prisma.auditLog.create({
      data: {
        companyId,
        actorId,
        action,
        entityType: "COMPANY_SWITCH_SESSION",
        entityId: sessionId,
        metadata
      }
    });

    this.eventBus.publish({
      name: eventName,
      companyId,
      actorId,
      entityId: sessionId,
      payload: metadata
    });
  }

  private normalizePlanCode(code: string) {
    return code.trim().toLowerCase();
  }

  private jsonObject(value: Record<string, unknown> | undefined): Prisma.InputJsonObject {
    return (value ?? {}) as Prisma.InputJsonObject;
  }

  private optionalDate(value: string | undefined) {
    return value ? new Date(value) : undefined;
  }

  private dateOrNow(value: string | undefined) {
    return this.optionalDate(value) ?? new Date();
  }

  private switchExpiresAt(value: string | undefined) {
    const expiresAt = value ? new Date(value) : new Date(Date.now() + 8 * 60 * 60 * 1000);

    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      throw new BadRequestException("Switch session expiration must be in the future");
    }

    return expiresAt;
  }

  private async expireSwitchSessions() {
    await this.prisma.companySwitchSession.updateMany({
      where: {
        status: CompanySwitchStatus.ACTIVE,
        expiresAt: { lt: new Date() },
        endedAt: null,
        revokedAt: null,
        deletedAt: null
      },
      data: { status: CompanySwitchStatus.EXPIRED }
    });
  }

  private async signSwitchToken(actor: RequestUser, sessionId: string, actingCompanyId: string, originalCompanyId: string, expiresAt: Date) {
    const secondsUntilExpiry = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

    return this.jwt.signAsync(
      {
        sub: actor.id,
        platformAdmin: true,
        switchSessionId: sessionId,
        actingCompanyId,
        originalCompanyId,
        permissions: actor.permissions
      },
      { expiresIn: secondsUntilExpiry }
    );
  }
}
