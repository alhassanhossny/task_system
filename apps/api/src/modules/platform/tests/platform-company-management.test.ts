import { ConfigService } from "@nestjs/config";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { CompanyPlan, CompanyStatus, SystemRole, UserStatus } from "@prisma/client";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { AuthService } from "../../../auth/auth.service";
import { PLATFORM_PERMISSIONS_KEY, PERMISSIONS, TENANT_HEADER } from "../../../common/constants";
import { IS_PUBLIC_KEY } from "../../../common/decorators/public.decorator";
import { TenantGuard } from "../../../common/guards/tenant.guard";
import { RequestUser } from "../../../common/types/request-user";
import { DomainEventBus } from "../../../domain-events/domain-event-bus.service";
import { DomainEvent } from "../../../domain-events/domain-event";
import { PrismaService } from "../../../prisma/prisma.service";
import { PlatformAdminGuard } from "../guards/platform-admin.guard";
import { PLATFORM_EVENTS } from "../platform.events";
import { PlatformService } from "../platform.service";

const prisma = new PrismaService();

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const eventBus = new DomainEventBus();
  const platformService = new PlatformService(prisma, eventBus, { signAsync: async () => "switch-token" } as unknown as JwtService);
  const events: DomainEvent[] = [];
  const eventSubscription = eventBus.events$.subscribe((event) => events.push(event));

  const [platformCompany, targetCompany, otherCompany] = await Promise.all([
    prisma.company.create({
      data: {
        name: `Platform ${suffix}`,
        slug: `platform-${suffix}`,
        status: CompanyStatus.ACTIVE,
        primaryDomain: `platform-${suffix}.example.com`,
        billingEmail: `platform-billing-${suffix}@example.com`
      }
    }),
    prisma.company.create({
      data: {
        name: `Managed Tenant ${suffix}`,
        slug: `managed-tenant-${suffix}`,
        status: CompanyStatus.TRIAL,
        plan: CompanyPlan.PROFESSIONAL,
        primaryDomain: `managed-${suffix}.example.com`,
        billingEmail: `accounts-${suffix}@example.com`,
        supportEmail: `support-${suffix}@example.com`
      }
    }),
    prisma.company.create({
      data: {
        name: `Other Tenant ${suffix}`,
        slug: `other-tenant-${suffix}`,
        status: CompanyStatus.ACTIVE,
        primaryDomain: `other-${suffix}.example.com`,
        billingEmail: `other-billing-${suffix}@example.com`
      }
    })
  ]);

  try {
    const [actor, tenantUser] = await Promise.all([
      createUser(platformCompany.id, `platform-admin-${suffix}@example.com`, "Platform Admin", "test"),
      createUser(targetCompany.id, `tenant-user-${suffix}@example.com`, "Tenant User", await bcrypt.hash("Password123!", 4))
    ]);
    const [plan, department] = await Promise.all([
      prisma.subscriptionPlan.create({
        data: {
          code: `pro-${suffix}`,
          name: "Professional",
          tier: CompanyPlan.PROFESSIONAL,
          monthlyPrice: 49,
          yearlyPrice: 490
        }
      }),
      prisma.department.create({
        data: {
          companyId: targetCompany.id,
          name: "Operations",
          code: `OPS-${suffix}`
        }
      })
    ]);
    await prisma.companySubscription.create({
      data: {
        companyId: targetCompany.id,
        planId: plan.id,
        status: "TRIALING",
        seats: 12
      }
    });
    const task = await prisma.task.create({
      data: {
        companyId: targetCompany.id,
        departmentId: department.id,
        createdById: tenantUser.id,
        taskNumber: `TASK-${suffix}`,
        title: "Platform detail task"
      }
    });
    await Promise.all([
      prisma.attachment.create({
        data: {
          companyId: targetCompany.id,
          entityType: "COMPANY",
          entityId: targetCompany.id,
          fileName: "usage.pdf",
          filePath: `/platform/${suffix}/usage.pdf`,
          mimeType: "application/pdf",
          fileSize: 4096,
          uploadedById: tenantUser.id
        }
      }),
      prisma.activity.create({
        data: {
          companyId: targetCompany.id,
          actorId: tenantUser.id,
          type: "TEST_ACTIVITY",
          title: "Tenant activity"
        }
      })
    ]);

    assertPlatformGuardAllowsPlatformPermissions(actor, platformCompany.id);
    assertPlatformGuardRejectsMissingPermissions(actor, platformCompany.id);
    assertPlatformGuardRejectsTenantPermissions(actor, platformCompany.id);

    const listByName = await platformService.listCompanies({ search: `Managed Tenant ${suffix}`, status: CompanyStatus.TRIAL, page: 1, limit: 10 });
    assert.equal(listByName.meta.total, 1);
    assert.equal(listByName.data[0].id, targetCompany.id);
    assert.equal(listByName.data[0].usersCount, 1);

    const listByDomain = await platformService.listCompanies({ search: `managed-${suffix}.example.com`, page: 1, limit: 10 });
    assert.equal(listByDomain.meta.total, 1);
    assert.equal(listByDomain.data[0].id, targetCompany.id);

    const listByBilling = await platformService.listCompanies({ search: `accounts-${suffix}@example.com`, page: 1, limit: 10 });
    assert.equal(listByBilling.meta.total, 1);
    assert.equal(listByBilling.data[0].id, targetCompany.id);

    const detail = await platformService.getCompany(targetCompany.id);
    assert.equal(detail.company.id, targetCompany.id);
    assert.equal(detail.subscription?.companyId, targetCompany.id);
    assert.equal(detail.usersCount, 1);
    assert.equal(detail.departmentsCount, 1);
    assert.equal(detail.tasksCount, 1);
    assert.equal(detail.storageUsage, 4096);
    assert.ok(detail.lastActivityAt instanceof Date);

    const suspended = await platformService.suspendCompany(targetCompany.id, actor.id, { reason: "Billing overdue" });
    assert.equal(suspended.status, CompanyStatus.SUSPENDED);
    assert.ok(suspended.suspendedAt instanceof Date);

    const suspendedAudit = await prisma.auditLog.findFirst({
      where: { companyId: targetCompany.id, actorId: actor.id, action: "COMPANY_SUSPENDED", entityId: targetCompany.id }
    });
    assert.ok(suspendedAudit);
    assert.equal((suspendedAudit.metadata as { reason?: string }).reason, "Billing overdue");
    assert.ok(events.some((event) => event.name === PLATFORM_EVENTS.companySuspended && event.companyId === targetCompany.id));

    const authService = new AuthService(
      prisma,
      { signAsync: async () => "access-token" } as unknown as JwtService,
      { get: <T>(_key: string, fallback: T) => fallback } as ConfigService
    );
    await assert.rejects(
      () => authService.login({ email: tenantUser.email, password: "Password123!", companyId: targetCompany.id }),
      /Company tenant is suspended/
    );

    const tenantGuard = new TenantGuard(reflector(), prisma);
    await assert.rejects(() => tenantGuard.canActivate(contextFor(tenantRequest(tenantUser.id, targetCompany.id))), hasStatus(403));
    await assert.rejects(
      () =>
        tenantGuard.canActivate(
          contextFor(
            tenantRequest(tenantUser.id, targetCompany.id, {
              [TENANT_HEADER]: otherCompany.id
            })
          )
        ),
      hasStatus(403)
    );

    const platformRouteTenantGuard = new TenantGuard(reflector([PERMISSIONS.platformRead]), prisma);
    assert.equal(await platformRouteTenantGuard.canActivate(contextFor(tenantRequest(actor.id, platformCompany.id))), true);

    const activated = await platformService.activateCompany(targetCompany.id, actor.id, { reason: "Payment received" });
    assert.equal(activated.status, CompanyStatus.ACTIVE);
    assert.equal(activated.suspendedAt, null);

    const activatedAudit = await prisma.auditLog.findFirst({
      where: { companyId: targetCompany.id, actorId: actor.id, action: "COMPANY_ACTIVATED", entityId: targetCompany.id }
    });
    assert.ok(activatedAudit);
    assert.equal((activatedAudit.metadata as { reason?: string }).reason, "Payment received");
    assert.ok(events.some((event) => event.name === PLATFORM_EVENTS.companyActivated && event.companyId === targetCompany.id));
    assert.equal(await tenantGuard.canActivate(contextFor(tenantRequest(tenantUser.id, targetCompany.id))), true);

    await assert.rejects(() => platformService.getCompany(randomUUID()), /Company not found/);
    assert.equal(task.companyId, targetCompany.id);

    console.log("Platform company management assertions passed for permissions, listing, detail, suspend, activate, suspended tenant blocking, tenant isolation, audit, and events.");
  } finally {
    eventSubscription.unsubscribe();
    await cleanup(platformCompany.id, targetCompany.id, otherCompany.id, planIdsForSuffix(suffix));
    await prisma.$disconnect();
  }
}

function createUser(companyId: string, email: string, name: string, passwordHash: string) {
  return prisma.user.create({
    data: {
      companyId,
      email,
      passwordHash,
      name,
      status: UserStatus.ACTIVE
    }
  });
}

function assertPlatformGuardAllowsPlatformPermissions(actor: { id: string; email: string }, companyId: string) {
  const guard = new PlatformAdminGuard(reflector([PERMISSIONS.platformRead]));
  const allowed = guard.canActivate(
    contextFor({
      user: {
        id: actor.id,
        companyId,
        email: actor.email,
        roles: [SystemRole.SUPER_ADMIN],
        permissions: [PERMISSIONS.platformRead]
      }
    })
  );
  assert.equal(allowed, true);
}

function assertPlatformGuardRejectsMissingPermissions(actor: { id: string; email: string }, companyId: string) {
  const guard = new PlatformAdminGuard(reflector([PERMISSIONS.platformManage]));
  assert.throws(
    () =>
      guard.canActivate(
        contextFor({
          user: {
            id: actor.id,
            companyId,
            email: actor.email,
            roles: [SystemRole.SUPER_ADMIN],
            permissions: [PERMISSIONS.platformRead]
          }
        })
      ),
    hasStatus(403)
  );
}

function assertPlatformGuardRejectsTenantPermissions(actor: { id: string; email: string }, companyId: string) {
  const guard = new PlatformAdminGuard(reflector([PERMISSIONS.companiesRead]));
  assert.throws(
    () =>
      guard.canActivate(
        contextFor({
          user: {
            id: actor.id,
            companyId,
            email: actor.email,
            roles: [SystemRole.SUPER_ADMIN],
            permissions: [PERMISSIONS.companiesRead]
          }
        })
      ),
    /only accepts platform permissions/
  );
}

function tenantRequest(userId: string, companyId: string, headers: Record<string, string> = {}) {
  return {
    headers,
    user: {
      id: userId,
      companyId,
      email: "tenant@example.com",
      roles: [],
      permissions: []
    }
  };
}

function reflector(platformPermissions?: string[]) {
  return {
    getAllAndOverride: <T>(key: string) => {
      if (key === IS_PUBLIC_KEY) return false as T;
      if (key === PLATFORM_PERMISSIONS_KEY) return platformPermissions as T;
      return undefined as T;
    }
  } as unknown as Reflector;
}

function contextFor(request: { user?: RequestUser; headers?: Record<string, string> }) {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;
}

function hasStatus(status: number) {
  return (error: unknown) => typeof error === "object" && error !== null && "getStatus" in error && (error as { getStatus: () => number }).getStatus() === status;
}

function planIdsForSuffix(suffix: string) {
  return [`pro-${suffix}`];
}

async function cleanup(platformCompanyId: string, targetCompanyId: string, otherCompanyId: string, planCodes: string[]) {
  const companyIds = [platformCompanyId, targetCompanyId, otherCompanyId];
  await prisma.refreshToken.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.auditLog.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.activity.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.attachment.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.taskWatcher.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.taskAssignee.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.task.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.department.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.companySubscription.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.subscriptionPlan.deleteMany({ where: { code: { in: planCodes } } });
  await prisma.userRole.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.rolePermission.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.permission.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.role.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
}

void main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
