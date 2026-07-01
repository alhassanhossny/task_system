import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import {
  CompanyPlan,
  CompanyStatus,
  EmailStatus,
  EntityType,
  LeaveDurationType,
  LeaveStatus,
  SubscriptionStatus,
  SystemRole,
  TaskStatus,
  UserStatus
} from "@prisma/client";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PLATFORM_PERMISSIONS_KEY, PERMISSIONS } from "../../../common/constants";
import { PERMISSIONS_KEY } from "../../../common/decorators/permissions.decorator";
import { IS_PUBLIC_KEY } from "../../../common/decorators/public.decorator";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RequestUser } from "../../../common/types/request-user";
import { DomainEvent } from "../../../domain-events/domain-event";
import { DomainEventBus } from "../../../domain-events/domain-event-bus.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { PlatformAdminGuard } from "../guards/platform-admin.guard";
import { PLATFORM_EVENTS } from "../platform.events";
import { PlatformUsageSnapshotsService } from "../platform-usage-snapshots.service";
import { PlatformService } from "../platform.service";

const prisma = new PrismaService();

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const eventBus = new DomainEventBus();
  const platformService = new PlatformService(prisma, eventBus, { signAsync: async () => "switch-token" } as unknown as JwtService);
  const usageSnapshotsService = new PlatformUsageSnapshotsService(prisma, eventBus);
  const events: DomainEvent[] = [];
  const eventSubscription = eventBus.events$.subscribe((event) => events.push(event));
  const baselineOverview = await platformService.getPlatformOverview({});
  const baselineDistribution = await platformService.getSubscriptionDistribution();

  const [platformCompany, companyA, companyB, companyC, deletedCompany] = await Promise.all([
    prisma.company.create({ data: { name: `Analytics Platform ${suffix}`, slug: `analytics-platform-${suffix}`, status: CompanyStatus.ACTIVE } }),
    prisma.company.create({
      data: {
        name: `Analytics Tenant A ${suffix}`,
        slug: `analytics-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
        plan: CompanyPlan.PROFESSIONAL
      }
    }),
    prisma.company.create({ data: { name: `Analytics Tenant B ${suffix}`, slug: `analytics-b-${suffix}`, status: CompanyStatus.TRIAL } }),
    prisma.company.create({ data: { name: `Analytics Tenant C ${suffix}`, slug: `analytics-c-${suffix}`, status: CompanyStatus.SUSPENDED, suspendedAt: new Date() } }),
    prisma.company.create({
      data: {
        name: `Analytics Deleted ${suffix}`,
        slug: `analytics-deleted-${suffix}`,
        status: CompanyStatus.ACTIVE,
        deletedAt: new Date()
      }
    })
  ]);

  try {
    const [actor, userA1, userA2, userB, userC, deletedUser] = await Promise.all([
      createUser(platformCompany.id, `analytics-admin-${suffix}@example.com`, "Analytics Admin"),
      createUser(companyA.id, `analytics-a1-${suffix}@example.com`, "Tenant A One"),
      createUser(companyA.id, `analytics-a2-${suffix}@example.com`, "Tenant A Two"),
      createUser(companyB.id, `analytics-b-${suffix}@example.com`, "Tenant B"),
      createUser(companyC.id, `analytics-c-${suffix}@example.com`, "Tenant C"),
      createUser(deletedCompany.id, `analytics-deleted-${suffix}@example.com`, "Deleted Tenant User")
    ]);
    await prisma.user.create({
      data: {
        companyId: companyA.id,
        email: `analytics-soft-deleted-${suffix}@example.com`,
        passwordHash: "test",
        name: "Soft Deleted",
        status: UserStatus.ACTIVE,
        deletedAt: new Date()
      }
    });

    const [starterPlan, professionalPlan, enterprisePlan] = await Promise.all([
      prisma.subscriptionPlan.create({
        data: {
          code: `analytics-starter-${suffix}`,
          name: "Analytics Starter",
          tier: CompanyPlan.STARTER
        }
      }),
      prisma.subscriptionPlan.create({
        data: {
          code: `analytics-professional-${suffix}`,
          name: "Analytics Professional",
          tier: CompanyPlan.PROFESSIONAL
        }
      }),
      prisma.subscriptionPlan.create({
        data: {
          code: `analytics-enterprise-${suffix}`,
          name: "Analytics Enterprise",
          tier: CompanyPlan.ENTERPRISE
        }
      })
    ]);

    await Promise.all([
      prisma.companySubscription.create({
        data: { companyId: companyA.id, planId: professionalPlan.id, status: SubscriptionStatus.ACTIVE, seats: 10 }
      }),
      prisma.companySubscription.create({
        data: { companyId: companyB.id, planId: starterPlan.id, status: SubscriptionStatus.TRIALING, seats: 5 }
      }),
      prisma.companySubscription.create({
        data: { companyId: companyC.id, planId: enterprisePlan.id, status: SubscriptionStatus.EXPIRED, seats: 3 }
      }),
      prisma.companySubscription.create({
        data: { companyId: platformCompany.id, planId: starterPlan.id, status: SubscriptionStatus.CANCELLED, seats: 1 }
      }),
      prisma.companySubscription.create({
        data: { companyId: deletedCompany.id, planId: enterprisePlan.id, status: SubscriptionStatus.ACTIVE, seats: 99 }
      })
    ]);

    const [departmentA, departmentB] = await Promise.all([
      prisma.department.create({ data: { companyId: companyA.id, name: "Operations", code: `OPS-${suffix}` } }),
      prisma.department.create({ data: { companyId: companyB.id, name: "People", code: `PPL-${suffix}` } })
    ]);

    await seedTenantUsage({
      suffix,
      companyA,
      companyB,
      deletedCompany,
      departmentA,
      departmentB,
      userA1,
      userA2,
      userB,
      deletedUser
    });

    assertPlatformAccess(actor, platformCompany.id);
    assert.equal(permissionGuard([PERMISSIONS.analyticsRead], requestUser(actor, platformCompany.id, [PERMISSIONS.analyticsRead])), true);
    assert.equal(permissionGuard([PERMISSIONS.analyticsRead], requestUser(userA1, companyA.id, [])), false);

    const overview = await platformService.getPlatformOverview({});
    assert.deepEqual(overview.companies, {
      total: baselineOverview.companies.total + 4,
      active: baselineOverview.companies.active + 2,
      suspended: baselineOverview.companies.suspended + 1,
      trialing: baselineOverview.companies.trialing + 1
    });
    assert.deepEqual(overview.subscriptions, {
      total: baselineOverview.subscriptions.total + 4,
      active: baselineOverview.subscriptions.active + 1,
      expired: baselineOverview.subscriptions.expired + 1,
      cancelled: baselineOverview.subscriptions.cancelled + 1
    });
    assert.equal(overview.users.total, baselineOverview.users.total + 5);
    assert.deepEqual(overview.usage, {
      totalTasks: baselineOverview.usage.totalTasks + 3,
      totalLeaveRequests: baselineOverview.usage.totalLeaveRequests + 2,
      totalEmails: baselineOverview.usage.totalEmails + 3,
      totalAttachments: baselineOverview.usage.totalAttachments + 3
    });

    const fixedDate = new Date("2026-07-01T10:00:00.000Z");
    const generated = await usageSnapshotsService.generateDailySnapshot({
      date: fixedDate,
      actorId: actor.id,
      actorCompanyId: platformCompany.id
    });
    assert.equal(generated.snapshots.length, baselineOverview.companies.total + 4);
    assert.ok(events.some((event) => event.name === PLATFORM_EVENTS.usageSnapshotCreated && event.companyId === companyA.id));

    const firstSnapshotCount = await prisma.platformUsageSnapshot.count({
      where: {
        companyId: { in: [platformCompany.id, companyA.id, companyB.id, companyC.id] },
        periodStart: generated.periodStart,
        periodEnd: generated.periodEnd
      }
    });
    assert.equal(firstSnapshotCount, 4);
    await usageSnapshotsService.generateDailySnapshot({ date: fixedDate, actorId: actor.id, actorCompanyId: platformCompany.id });
    const secondSnapshotCount = await prisma.platformUsageSnapshot.count({
      where: {
        companyId: { in: [platformCompany.id, companyA.id, companyB.id, companyC.id] },
        periodStart: generated.periodStart,
        periodEnd: generated.periodEnd
      }
    });
    assert.equal(secondSnapshotCount, firstSnapshotCount);

    const companyASnapshot = await prisma.platformUsageSnapshot.findUniqueOrThrow({
      where: {
        companyId_periodStart_periodEnd: {
          companyId: companyA.id,
          periodStart: generated.periodStart,
          periodEnd: generated.periodEnd
        }
      }
    });
    assert.equal(Number(companyASnapshot.storageBytes), 6144);
    assert.equal((companyASnapshot.metadata as { departmentCount?: number; planTier?: string }).departmentCount, 1);
    assert.equal((companyASnapshot.metadata as { departmentCount?: number; planTier?: string }).planTier, CompanyPlan.PROFESSIONAL);

    const snapshotAudit = await prisma.auditLog.findFirst({
      where: { companyId: platformCompany.id, actorId: actor.id, action: "USAGE_SNAPSHOT_GENERATED" }
    });
    assert.ok(snapshotAudit);

    const usage = await platformService.getUsageMetrics({ range: "7d", periodTo: fixedDate.toISOString(), companyId: companyA.id });
    const dateKey = "2026-07-01";
    assert.equal(usage.range, "7d");
    assert.equal(usage.companies.find((point) => point.date === dateKey)?.value, 1);
    assert.equal(usage.users.find((point) => point.date === dateKey)?.value, 2);
    assert.equal(usage.tasks.find((point) => point.date === dateKey)?.value, 2);
    assert.equal(usage.emails.find((point) => point.date === dateKey)?.value, 1);

    const topCompanies = await platformService.getTopCompanies({ companyId: companyA.id });
    assert.equal(topCompanies[0].companyId, companyA.id);
    assert.equal(topCompanies[0].users, 2);
    assert.equal(topCompanies[0].tasks, 2);
    assert.equal(topCompanies[0].emails, 2);
    assert.equal(topCompanies[0].storageBytes, 6144);
    assert.ok(!topCompanies.some((company) => company.companyId === deletedCompany.id));

    const distribution = await platformService.getSubscriptionDistribution();
    assert.equal(distribution[CompanyPlan.STARTER], baselineDistribution[CompanyPlan.STARTER] + 1);
    assert.equal(distribution[CompanyPlan.PROFESSIONAL], baselineDistribution[CompanyPlan.PROFESSIONAL] + 1);
    assert.equal(distribution[CompanyPlan.ENTERPRISE], baselineDistribution[CompanyPlan.ENTERPRISE]);

    const companyOnlyOverview = await platformService.getPlatformOverview({ companyId: companyB.id });
    assert.equal(companyOnlyOverview.companies.total, 1);
    assert.equal(companyOnlyOverview.users.total, 1);
    assert.equal(companyOnlyOverview.usage.totalTasks, 1);

    console.log("Platform analytics assertions passed for overview counts, usage snapshots, duplicate prevention, top companies, subscription distribution, permissions, and cross-tenant reporting.");
  } finally {
    eventSubscription.unsubscribe();
    await cleanup([platformCompany.id, companyA.id, companyB.id, companyC.id, deletedCompany.id], suffix);
    await prisma.$disconnect();
  }
}

function createUser(companyId: string, email: string, name: string) {
  return prisma.user.create({
    data: {
      companyId,
      email,
      passwordHash: "test",
      name,
      status: UserStatus.ACTIVE
    }
  });
}

async function seedTenantUsage(input: {
  suffix: string;
  companyA: { id: string };
  companyB: { id: string };
  deletedCompany: { id: string };
  departmentA: { id: string };
  departmentB: { id: string };
  userA1: { id: string };
  userA2: { id: string };
  userB: { id: string };
  deletedUser: { id: string };
}) {
  await Promise.all([
    prisma.task.create({
      data: {
        companyId: input.companyA.id,
        departmentId: input.departmentA.id,
        createdById: input.userA1.id,
        taskNumber: `AN-A-1-${input.suffix}`,
        title: "Tenant A Open Task",
        status: TaskStatus.IN_PROGRESS
      }
    }),
    prisma.task.create({
      data: {
        companyId: input.companyA.id,
        departmentId: input.departmentA.id,
        createdById: input.userA2.id,
        taskNumber: `AN-A-2-${input.suffix}`,
        title: "Tenant A Completed Task",
        status: TaskStatus.COMPLETED
      }
    }),
    prisma.task.create({
      data: {
        companyId: input.companyB.id,
        departmentId: input.departmentB.id,
        createdById: input.userB.id,
        taskNumber: `AN-B-1-${input.suffix}`,
        title: "Tenant B Task",
        status: TaskStatus.NEW
      }
    }),
    prisma.task.create({
      data: {
        companyId: input.companyA.id,
        departmentId: input.departmentA.id,
        createdById: input.userA1.id,
        taskNumber: `AN-A-DELETED-${input.suffix}`,
        title: "Soft Deleted Task",
        deletedAt: new Date()
      }
    }),
    prisma.task.create({
      data: {
        companyId: input.deletedCompany.id,
        createdById: input.deletedUser.id,
        taskNumber: `AN-DELETED-${input.suffix}`,
        title: "Deleted Company Task"
      }
    })
  ]);

  await Promise.all([
    prisma.leaveRequest.create({
      data: {
        companyId: input.companyA.id,
        employeeId: input.userA1.id,
        departmentId: input.departmentA.id,
        requestNumber: `LR-A-${input.suffix}`,
        leaveType: "Annual",
        startsAt: new Date("2026-07-10T00:00:00.000Z"),
        endsAt: new Date("2026-07-12T00:00:00.000Z"),
        durationType: LeaveDurationType.FULL_DAY,
        durationDays: 3,
        status: LeaveStatus.APPROVED
      }
    }),
    prisma.leaveRequest.create({
      data: {
        companyId: input.companyB.id,
        employeeId: input.userB.id,
        departmentId: input.departmentB.id,
        requestNumber: `LR-B-${input.suffix}`,
        leaveType: "Sick",
        startsAt: new Date("2026-07-15T00:00:00.000Z"),
        endsAt: new Date("2026-07-15T00:00:00.000Z"),
        durationType: LeaveDurationType.FULL_DAY,
        durationDays: 1,
        status: LeaveStatus.PENDING
      }
    })
  ]);

  await Promise.all([
    prisma.email.create({
      data: {
        companyId: input.companyA.id,
        createdById: input.userA1.id,
        subject: "Tenant A Sent",
        body: "Sent body",
        status: EmailStatus.SENT,
        sentAt: new Date("2026-07-01T09:00:00.000Z")
      }
    }),
    prisma.email.create({
      data: {
        companyId: input.companyA.id,
        createdById: input.userA2.id,
        subject: "Tenant A Draft",
        body: "Draft body",
        status: EmailStatus.DRAFT
      }
    }),
    prisma.email.create({
      data: {
        companyId: input.companyB.id,
        createdById: input.userB.id,
        subject: "Tenant B Sent",
        body: "Sent body",
        status: EmailStatus.SENT,
        sentAt: new Date("2026-07-01T10:00:00.000Z")
      }
    })
  ]);

  await Promise.all([
    prisma.attachment.create({
      data: {
        companyId: input.companyA.id,
        entityType: EntityType.COMPANY,
        entityId: input.companyA.id,
        fileName: "a-one.pdf",
        filePath: `/analytics/${input.suffix}/a-one.pdf`,
        mimeType: "application/pdf",
        fileSize: 4096,
        uploadedById: input.userA1.id
      }
    }),
    prisma.attachment.create({
      data: {
        companyId: input.companyA.id,
        entityType: EntityType.COMPANY,
        entityId: input.companyA.id,
        fileName: "a-two.pdf",
        filePath: `/analytics/${input.suffix}/a-two.pdf`,
        mimeType: "application/pdf",
        fileSize: 2048,
        uploadedById: input.userA2.id
      }
    }),
    prisma.attachment.create({
      data: {
        companyId: input.companyB.id,
        entityType: EntityType.COMPANY,
        entityId: input.companyB.id,
        fileName: "b-one.pdf",
        filePath: `/analytics/${input.suffix}/b-one.pdf`,
        mimeType: "application/pdf",
        fileSize: 1024,
        uploadedById: input.userB.id
      }
    }),
    prisma.attachment.create({
      data: {
        companyId: input.deletedCompany.id,
        entityType: EntityType.COMPANY,
        entityId: input.deletedCompany.id,
        fileName: "deleted.pdf",
        filePath: `/analytics/${input.suffix}/deleted.pdf`,
        mimeType: "application/pdf",
        fileSize: 999999,
        uploadedById: input.deletedUser.id
      }
    })
  ]);
}

function assertPlatformAccess(actor: { id: string; email: string }, companyId: string) {
  const guard = new PlatformAdminGuard(reflector([PERMISSIONS.platformRead]));
  assert.equal(guard.canActivate(contextFor({ user: requestUser(actor, companyId, [PERMISSIONS.platformRead]) })), true);
  assert.throws(() => guard.canActivate(contextFor({ user: requestUser(actor, companyId, []) })), hasStatus(403));
}

function permissionGuard(required: string[], user: RequestUser) {
  const guard = new PermissionsGuard(reflector(undefined, required));
  return guard.canActivate(contextFor({ headers: {}, user }));
}

function requestUser(user: { id: string; email: string }, companyId: string, permissions: string[]): RequestUser {
  return {
    id: user.id,
    companyId,
    email: user.email,
    roles: permissions.includes(PERMISSIONS.platformRead) ? [SystemRole.SUPER_ADMIN] : [],
    permissions
  };
}

function reflector(platformPermissions?: string[], requiredPermissions?: string[]) {
  return {
    getAllAndOverride: <T>(key: string) => {
      if (key === IS_PUBLIC_KEY) return false as T;
      if (key === PLATFORM_PERMISSIONS_KEY) return platformPermissions as T;
      if (key === PERMISSIONS_KEY) return requiredPermissions as T;
      return undefined as T;
    }
  } as unknown as Reflector;
}

function contextFor(request: { user?: RequestUser; headers?: Record<string, string>; companyId?: string }) {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;
}

function hasStatus(status: number) {
  return (error: unknown) => typeof error === "object" && error !== null && "status" in error && error.status === status;
}

async function cleanup(companyIds: string[], suffix: string) {
  await prisma.platformUsageSnapshot.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.auditLog.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.attachment.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.email.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.leaveRequest.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.task.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.department.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.companySubscription.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  await prisma.subscriptionPlan.deleteMany({
    where: {
      code: {
        in: [`analytics-starter-${suffix}`, `analytics-professional-${suffix}`, `analytics-enterprise-${suffix}`]
      }
    }
  });
}

void main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
