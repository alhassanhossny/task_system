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
    const snapshots: PlatformUsageSnapshotSummary[] = [];

    for (const company of companies) {
      const metrics = await this.collectCompanyMetrics(company.id);
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

  async collectCompanyMetrics(companyId: string): Promise<Omit<PlatformUsageSnapshotSummary, "id" | "companyId" | "periodStart" | "periodEnd">> {
    const [
      usersCount,
      activeUsersCount,
      departmentCount,
      tasksCount,
      openTasksCount,
      leaveRequestsCount,
      emailsSentCount,
      storageAggregate,
      activeSubscription
    ] = await Promise.all([
      this.prisma.user.count({ where: { companyId, deletedAt: null } }),
      this.prisma.user.count({ where: { companyId, status: UserStatus.ACTIVE, deletedAt: null } }),
      this.prisma.department.count({ where: { companyId, deletedAt: null } }),
      this.prisma.task.count({ where: { companyId, deletedAt: null } }),
      this.prisma.task.count({ where: { companyId, deletedAt: null, status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] } } }),
      this.prisma.leaveRequest.count({ where: { companyId, deletedAt: null } }),
      this.prisma.email.count({ where: { companyId, status: EmailStatus.SENT, deletedAt: null } }),
      this.prisma.attachment.aggregate({ where: { companyId, deletedAt: null }, _sum: { fileSize: true } }),
      this.activeSubscription(companyId)
    ]);

    return {
      usersCount,
      activeUsersCount,
      departmentCount,
      tasksCount,
      openTasksCount,
      leaveRequestsCount,
      emailsSentCount,
      storageBytes: storageAggregate._sum.fileSize ?? 0,
      activeSubscription: activeSubscription
        ? {
            id: activeSubscription.id,
            status: activeSubscription.status,
            planId: activeSubscription.planId,
            planCode: activeSubscription.plan.code,
            planTier: activeSubscription.plan.tier
          }
        : null
    };
  }

  dailyPeriod(date: Date) {
    const periodStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));

    return { periodStart, periodEnd };
  }

  private activeSubscription(companyId: string) {
    return this.prisma.companySubscription.findFirst({
      where: {
        companyId,
        deletedAt: null,
        status: { in: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE] }
      },
      orderBy: { createdAt: "desc" },
      include: { plan: true }
    });
  }

  private snapshotMetadata(metrics: Omit<PlatformUsageSnapshotSummary, "id" | "companyId" | "periodStart" | "periodEnd">): Prisma.InputJsonObject {
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
