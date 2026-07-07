import { ConfigService } from "@nestjs/config";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { CompanyStatus, CompanySwitchStatus, SystemRole, UserStatus } from "@prisma/client";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AuthService } from "../../../auth/auth.service";
import { PLATFORM_PERMISSIONS_KEY, PERMISSIONS, TENANT_HEADER } from "../../../common/constants";
import { PERMISSIONS_KEY } from "../../../common/decorators/permissions.decorator";
import { IS_PUBLIC_KEY } from "../../../common/decorators/public.decorator";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { TenantGuard } from "../../../common/guards/tenant.guard";
import { RequestUser } from "../../../common/types/request-user";
import { DomainEvent } from "../../../domain-events/domain-event";
import { DomainEventBus } from "../../../domain-events/domain-event-bus.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { PLATFORM_EVENTS } from "../platform.events";
import { PlatformService } from "../platform.service";

const prisma = new PrismaService();

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const eventBus = new DomainEventBus();
  const jwt = new JwtService({ secret: `switch-secret-${suffix}` });
  const platformService = new PlatformService(prisma, eventBus, jwt);
  const authService = new AuthService(prisma, jwt, { get: <T>(_key: string, fallback: T) => fallback } as ConfigService);
  const events: DomainEvent[] = [];
  const eventSubscription = eventBus.events$.subscribe((event) => events.push(event));

  const [platformCompany, targetCompany, otherCompany, suspendedCompany] = await Promise.all([
    prisma.company.create({ data: { name: `Switch Platform ${suffix}`, slug: `switch-platform-${suffix}`, status: CompanyStatus.ACTIVE } }),
    prisma.company.create({ data: { name: `Switch Target ${suffix}`, slug: `switch-target-${suffix}`, status: CompanyStatus.ACTIVE } }),
    prisma.company.create({ data: { name: `Switch Other ${suffix}`, slug: `switch-other-${suffix}`, status: CompanyStatus.ACTIVE } }),
    prisma.company.create({ data: { name: `Switch Suspended ${suffix}`, slug: `switch-suspended-${suffix}`, status: CompanyStatus.SUSPENDED, suspendedAt: new Date() } })
  ]);

  try {
    const actor = await prisma.user.create({
      data: {
        companyId: platformCompany.id,
        email: `switch-admin-${suffix}@example.com`,
        passwordHash: "test",
        name: "Switch Admin",
        status: UserStatus.ACTIVE
      }
    });
    await seedSuperAdminAccess(platformCompany.id, actor.id);

    const actorRequestUser: RequestUser = {
      id: actor.id,
      companyId: platformCompany.id,
      email: actor.email,
      roles: [SystemRole.SUPER_ADMIN],
      permissions: [PERMISSIONS.platformManage, PERMISSIONS.platformRead, PERMISSIONS.tenantSwitchExecute]
    };

    assert.equal(permissionGuard([PERMISSIONS.tenantSwitchExecute], { ...actorRequestUser, roles: [], permissions: [] }), false);
    assert.equal(permissionGuard([PERMISSIONS.tenantSwitchExecute], actorRequestUser), true);

    await assert.rejects(() => platformService.createSwitchSession(actorRequestUser, { companyId: suspendedCompany.id }), /suspended company/);

    const created = await platformService.createSwitchSession(actorRequestUser, {
      companyId: targetCompany.id,
      reason: "Support case",
      metadata: { ticketId: `SUP-${suffix}` }
    });
    assert.equal(created.companyId, targetCompany.id);
    assert.equal(created.status, CompanySwitchStatus.ACTIVE);
    assert.ok(created.sessionId);
    assert.ok(created.token);
    assert.ok(created.expiresAt instanceof Date);

    const decoded = await jwt.verifyAsync<{
      sub: string;
      platformAdmin: boolean;
      switchSessionId: string;
      actingCompanyId: string;
      originalCompanyId: string;
      permissions: string[];
    }>(created.token);
    assert.equal(decoded.sub, actor.id);
    assert.equal(decoded.platformAdmin, true);
    assert.equal(decoded.switchSessionId, created.sessionId);
    assert.equal(decoded.actingCompanyId, targetCompany.id);
    assert.equal(decoded.originalCompanyId, platformCompany.id);
    assert.ok(decoded.permissions.includes(PERMISSIONS.tenantSwitchExecute));

    const startedAudit = await prisma.auditLog.findFirst({
      where: { companyId: targetCompany.id, actorId: actor.id, action: "COMPANY_SWITCH_STARTED", entityId: created.sessionId }
    });
    assert.ok(startedAudit);
    assert.ok(events.some((event) => event.name === PLATFORM_EVENTS.switchCreated && event.companyId === targetCompany.id && event.entityId === created.sessionId));

    await assert.rejects(() => platformService.createSwitchSession(actorRequestUser, { companyId: targetCompany.id }), /already exists/);

    const switchedUser = (await authService.validateUser(decoded.sub, decoded)) as RequestUser;
    assert.equal(switchedUser.companyId, targetCompany.id);
    assert.equal(switchedUser.actingCompanyId, targetCompany.id);
    assert.equal(switchedUser.originalCompanyId, platformCompany.id);
    assert.equal(switchedUser.switchSessionId, created.sessionId);
    assert.equal(switchedUser.platformAdmin, true);

    const tenantRequest = { headers: {}, user: switchedUser, companyId: undefined as string | undefined };
    const tenantGuard = new TenantGuard(reflector(), prisma);
    assert.equal(await tenantGuard.canActivate(contextFor(tenantRequest)), true);
    assert.equal(tenantRequest.companyId, targetCompany.id);

    await assert.rejects(
      () => tenantGuard.canActivate(contextFor({ headers: { [TENANT_HEADER]: otherCompany.id }, user: switchedUser })),
      /Cannot override/
    );

    const listed = await platformService.listSwitchSessions({ status: CompanySwitchStatus.ACTIVE, page: 1, limit: 10 });
    assert.ok(listed.data.some((session) => session.id === created.sessionId && session.targetCompany.id === targetCompany.id && session.actorUser.id === actor.id));

    const expiredSession = await prisma.companySwitchSession.create({
      data: {
        companyId: otherCompany.id,
        actorCompanyId: platformCompany.id,
        actorUserId: actor.id,
        status: CompanySwitchStatus.ACTIVE,
        startedAt: new Date(Date.now() - 120_000),
        expiresAt: new Date(Date.now() - 60_000)
      }
    });
    const expired = await platformService.listSwitchSessions({ status: CompanySwitchStatus.EXPIRED, page: 1, limit: 10 });
    assert.ok(expired.data.some((session) => session.id === expiredSession.id));

    await assert.rejects(
      () =>
        authService.validateUser(actor.id, {
          platformAdmin: true,
          switchSessionId: expiredSession.id,
          actingCompanyId: otherCompany.id,
          originalCompanyId: platformCompany.id
        }),
      /not active|expired/
    );

    const ended = await platformService.endSwitchSession(actor.id, created.sessionId);
    assert.equal(ended.status, CompanySwitchStatus.ENDED);
    assert.ok(ended.endedAt instanceof Date);

    const endedAudit = await prisma.auditLog.findFirst({
      where: { companyId: targetCompany.id, actorId: actor.id, action: "COMPANY_SWITCH_ENDED", entityId: created.sessionId }
    });
    assert.ok(endedAudit);
    assert.ok(events.some((event) => event.name === PLATFORM_EVENTS.switchEnded && event.companyId === targetCompany.id && event.entityId === created.sessionId));

    await assert.rejects(() => authService.validateUser(decoded.sub, decoded), /not active/);
    await assert.rejects(() => platformService.endSwitchSession(actor.id, created.sessionId), /not active/);

    const second = await platformService.createSwitchSession(actorRequestUser, { companyId: targetCompany.id, reason: "Follow-up" });
    assert.notEqual(second.sessionId, created.sessionId);

    console.log("Platform company switching assertions passed for permissions, token creation, tenant resolution, listing, ending, expiration, suspended rejection, duplicate active sessions, tenant isolation, audit, and events.");
  } finally {
    eventSubscription.unsubscribe();
    await cleanup([platformCompany.id, targetCompany.id, otherCompany.id, suspendedCompany.id]);
    await prisma.$disconnect();
  }
}

async function seedSuperAdminAccess(companyId: string, userId: string) {
  const role = await prisma.role.create({
    data: {
      companyId,
      name: "Super Admin",
      systemName: SystemRole.SUPER_ADMIN
    }
  });
  const permissions = await Promise.all(
    [PERMISSIONS.platformRead, PERMISSIONS.platformManage, PERMISSIONS.tenantSwitchExecute].map((permission) => {
      const [subject, action] = permission.split(":");
      return prisma.permission.create({
        data: {
          companyId,
          subject,
          action
        }
      });
    })
  );
  await prisma.userRole.create({ data: { companyId, userId, roleId: role.id } });
  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({
      companyId,
      roleId: role.id,
      permissionId: permission.id
    }))
  });
}

function permissionGuard(required: string[], user: RequestUser) {
  const guard = new PermissionsGuard(reflector(undefined, required));
  return guard.canActivate(contextFor({ headers: {}, user }));
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

async function cleanup(companyIds: string[]) {
  await prisma.companySwitchSession.deleteMany({ where: { OR: [{ companyId: { in: companyIds } }, { actorCompanyId: { in: companyIds } }] } });
  await prisma.auditLog.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.rolePermission.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.userRole.deleteMany({ where: { companyId: { in: companyIds } } });
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
