import { Injectable } from "@nestjs/common";
import { CompanyPlan, EmailStatus, Prisma, SubscriptionStatus, TaskStatus, UserStatus } from "@prisma/client";
import { DomainEventBus } from "../../domain-events/domain-event-bus.service";
import { PrismaService } from "../../prisma/prisma.service";
import { PLATFORM_EVENTS } from "./platform.events";

type GenerateSnapshotOptions = {
  date?: Date;
  actorId?: string;
  actorCompanyId?: string;
};

type ActiveSubscriptionSnapshot = {
  id: string;
  status: SubscriptionStatus;
  planId: string;
  planCode: string;
  planTier: CompanyPlan;
};

export type PlatformUsageSnapshotSummary = {
  id: string;
  companyId: string;
  periodStart: Date;
  periodEnd: Date;
  usersCount: number;
  activeUsersCount: number;
  departmentCount: number;
  tasksCount: number;
  openTasksCount: number;
  leaveRequestsCount: number;
  emailsSentCount: number;
  storageBytes: number;
  activeSubscription: ActiveSubscriptionSnapshot | null;
};

type CompanyUsageMetrics = Omit<PlatformUsageSnapshotSummary, "id" | "companyId" | "periodStart" | "periodEnd">;

@Injectable()
export class PlatformUsageSnapshotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus
  ) {}

  async generateDailySnapshot(options: GenerateSnapshotOptions = {}) {
    const { periodStart, periodEnd } = this.dailyPeriod(options.date ?? new Date());
    const companies = await this.prisma.company.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true }
    });
    const metricsByCompany = await this.collectCompanyMetricsByCompany(companies.map((company) => company.id));
    const snapshots: PlatformUsageSnapshotSummary[] = [];

    for (const company of companies) {
      const metrics = metricsByCompany.get(company.id) ?? this.emptyMetrics();
      const snapshot = await this.prisma.platformUsageSnapshot.upsert({
        where: {
          companyId_periodStart_periodEnd: {
            companyId: company.id,
            periodStart,
            periodEnd
          }
        },
        create: {
          companyId: company.id,
          periodStart,
          periodEnd,
          usersCount: metrics.usersCount,
          activeUsersCount: metrics.activeUsersCount,
          tasksCount: metrics.tasksCount,
          openTasksCount: metrics.openTasksCount,
          leaveRequestsCount: metrics.leaveRequestsCount,
          emailsSentCount: metrics.emailsSentCount,
          storageBytes: BigInt(metrics.storageBytes),
          metadata: this.snapshotMetadata(metrics)
        },
        update: {
          usersCount: metrics.usersCount,
          activeUsersCount: metrics.activeUsersCount,
          tasksCount: metrics.tasksCount,
          openTasksCount: metrics.openTasksCount,
          leaveRequestsCount: metrics.leaveRequestsCount,
          emailsSentCount: metrics.emailsSentCount,
          storageBytes: BigInt(metrics.storageBytes),
          metadata: this.snapshotMetadata(metrics),
          deletedAt: null
        }
      });

      snapshots.push({
        id: snapshot.id,
        companyId: snapshot.companyId,
        periodStart: snapshot.periodStart,
        periodEnd: snapshot.periodEnd,
        ...metrics
      });

      this.eventBus.publish({
        name: PLATFORM_EVENTS.usageSnapshotCreated,
        companyId: company.id,
        actorId: options.actorId ?? null,
        entityId: snapshot.id,
        payload: {
          companyName: company.name,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          usersCount: metrics.usersCount,
          tasksCount: metrics.tasksCount,
          emailsSentCount: metrics.emailsSentCount,
          storageBytes: metrics.storageBytes
        }
      });
    }

    if (options.actorId && options.actorCompanyId) {
      await this.prisma.auditLog.create({
        data: {
          companyId: options.actorCompanyId,
          actorId: options.actorId,
          action: "USAGE_SNAPSHOT_GENERATED",
          entityType: "PLATFORM_USAGE_SNAPSHOT",
          metadata: {
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            companyCount: snapshots.length
          }
        }
      });
    }

    return {
      periodStart,
      periodEnd,
      snapshots
    };
  }

  async collectCompanyMetrics(companyId: string): Promise<CompanyUsageMetrics> {
    const metricsByCompany = await this.collectCompanyMetricsByCompany([companyId]);
    return metricsByCompany.get(companyId) ?? this.emptyMetrics();
  }

  private async collectCompanyMetricsByCompany(companyIds: string[]): Promise<Map<string, CompanyUsageMetrics>> {
    const metricsByCompany = new Map<string, CompanyUsageMetrics>();

    if (!companyIds.length) {
      return metricsByCompany;
    }

    const [
      userCounts,
      activeUserCounts,
      departmentCounts,
      taskCounts,
      openTaskCounts,
      leaveRequestCounts,
      sentEmailCounts,
      storageAggregates,
      activeSubscriptions
    ] = await Promise.all([
      this.prisma.user.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds }, deletedAt: null },
        _count: { _all: true }
      }),
      this.prisma.user.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds }, status: UserStatus.ACTIVE, deletedAt: null },
        _count: { _all: true }
      }),
      this.prisma.department.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds }, deletedAt: null },
        _count: { _all: true }
      }),
      this.prisma.task.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds }, deletedAt: null },
        _count: { _all: true }
      }),
      this.prisma.task.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds }, deletedAt: null, status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] } },
        _count: { _all: true }
      }),
      this.prisma.leaveRequest.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds }, deletedAt: null },
        _count: { _all: true }
      }),
      this.prisma.email.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds }, status: EmailStatus.SENT, deletedAt: null },
        _count: { _all: true }
      }),
      this.prisma.attachment.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds }, deletedAt: null },
        _sum: { fileSize: true }
      }),
      this.activeSubscriptions(companyIds)
    ]);
    const usersByCompany = this.countsByCompany(userCounts);
    const activeUsersByCompany = this.countsByCompany(activeUserCounts);
    const departmentsByCompany = this.countsByCompany(departmentCounts);
    const tasksByCompany = this.countsByCompany(taskCounts);
    const openTasksByCompany = this.countsByCompany(openTaskCounts);
    const leaveRequestsByCompany = this.countsByCompany(leaveRequestCounts);
    const sentEmailsByCompany = this.countsByCompany(sentEmailCounts);
    const storageByCompany = new Map(storageAggregates.map((row) => [row.companyId, row._sum.fileSize ?? 0]));
    const activeSubscriptionByCompany = this.activeSubscriptionByCompany(activeSubscriptions);

    for (const companyId of companyIds) {
      metricsByCompany.set(companyId, {
        usersCount: usersByCompany.get(companyId) ?? 0,
        activeUsersCount: activeUsersByCompany.get(companyId) ?? 0,
        departmentCount: departmentsByCompany.get(companyId) ?? 0,
        tasksCount: tasksByCompany.get(companyId) ?? 0,
        openTasksCount: openTasksByCompany.get(companyId) ?? 0,
        leaveRequestsCount: leaveRequestsByCompany.get(companyId) ?? 0,
        emailsSentCount: sentEmailsByCompany.get(companyId) ?? 0,
        storageBytes: storageByCompany.get(companyId) ?? 0,
        activeSubscription: activeSubscriptionByCompany.get(companyId) ?? null
      });
    }

    return metricsByCompany;
  }

  dailyPeriod(date: Date) {
    const periodStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));

    return { periodStart, periodEnd };
  }

  private activeSubscriptions(companyIds: string[]) {
    return this.prisma.companySubscription.findMany({
      where: {
        companyId: { in: companyIds },
        deletedAt: null,
        status: { in: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE] }
      },
      orderBy: [{ companyId: "asc" }, { createdAt: "desc" }],
      include: { plan: true }
    });
  }

  private countsByCompany(rows: Array<{ companyId: string; _count: { _all: number } }>) {
    return new Map(rows.map((row) => [row.companyId, row._count._all]));
  }

  private activeSubscriptionByCompany(
    subscriptions: Awaited<ReturnType<PlatformUsageSnapshotsService["activeSubscriptions"]>>
  ): Map<string, ActiveSubscriptionSnapshot> {
    const activeSubscriptionByCompany = new Map<string, ActiveSubscriptionSnapshot>();

    for (const subscription of subscriptions) {
      if (activeSubscriptionByCompany.has(subscription.companyId)) {
        continue;
      }
      activeSubscriptionByCompany.set(subscription.companyId, {
        id: subscription.id,
        status: subscription.status,
        planId: subscription.planId,
        planCode: subscription.plan.code,
        planTier: subscription.plan.tier
      });
    }

    return activeSubscriptionByCompany;
  }

  private emptyMetrics(): CompanyUsageMetrics {
    return {
      usersCount: 0,
      activeUsersCount: 0,
      departmentCount: 0,
      tasksCount: 0,
      openTasksCount: 0,
      leaveRequestsCount: 0,
      emailsSentCount: 0,
      storageBytes: 0,
      activeSubscription: null
    };
  }

  private snapshotMetadata(metrics: CompanyUsageMetrics): Prisma.InputJsonObject {
    return {
      departmentCount: metrics.departmentCount,
      ...(metrics.activeSubscription
        ? {
            activeSubscriptionId: metrics.activeSubscription.id,
            subscriptionStatus: metrics.activeSubscription.status,
            planId: metrics.activeSubscription.planId,
            planCode: metrics.activeSubscription.planCode,
            planTier: metrics.activeSubscription.planTier
          }
        : {})
    };
  }
}
