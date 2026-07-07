import { INestApplication, Inject, Injectable, Module, ValidationPipe } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD, NestFactory, Reflector } from "@nestjs/core";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { BillingInterval, CompanyPlan, CompanyStatus, CompanySwitchStatus, SubscriptionStatus, SystemRole, UserStatus } from "@prisma/client";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AddressInfo } from "node:net";
import { AuthController } from "../../../auth/auth.controller";
import { AuthService } from "../../../auth/auth.service";
import { PERMISSIONS } from "../../../common/constants";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { TenantGuard } from "../../../common/guards/tenant.guard";
import { DomainEventsModule } from "../../../domain-events/domain-events.module";
import { PrismaModule } from "../../../prisma/prisma.module";
import { PrismaService } from "../../../prisma/prisma.service";
import { PlatformAdminGuard } from "../guards/platform-admin.guard";
import { PlatformModule } from "../platform.module";

const prisma = new PrismaService();
let currentPhase = "not started";

@Injectable()
class PlatformSecurityJwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_SECRET", "change-me-in-production")
    });
  }

  validate(payload: {
    sub: string;
    platformAdmin?: boolean;
    switchSessionId?: string;
    actingCompanyId?: string;
    originalCompanyId?: string | null;
  }) {
    return this.authService.validateUser(payload.sub, payload);
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET", "change-me-in-production"),
        signOptions: { expiresIn: 15 * 60 }
      })
    }),
    DomainEventsModule,
    PrismaModule,
    PlatformModule
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: AuthService,
      inject: [PrismaService, JwtService, ConfigService],
      useFactory: (prismaService: PrismaService, jwtService: JwtService, configService: ConfigService) =>
        new AuthService(prismaService, jwtService, configService)
    },
    {
      provide: PlatformAdminGuard,
      inject: [Reflector],
      useFactory: (reflector: Reflector) => new PlatformAdminGuard(reflector)
    },
    PlatformSecurityJwtStrategy,
    {
      provide: APP_GUARD,
      inject: [Reflector],
      useFactory: (reflector: Reflector) => new JwtAuthGuard(reflector)
    },
    {
      provide: APP_GUARD,
      inject: [Reflector, PrismaService],
      useFactory: (reflector: Reflector, prismaService: PrismaService) => new TenantGuard(reflector, prismaService)
    },
    {
      provide: APP_GUARD,
      inject: [Reflector],
      useFactory: (reflector: Reflector) => new RolesGuard(reflector)
    },
    {
      provide: APP_GUARD,
      inject: [Reflector],
      useFactory: (reflector: Reflector) => new PermissionsGuard(reflector)
    }
  ]
})
class PlatformSecurityTestModule {}

type HttpMethod = "GET" | "POST" | "PATCH";

type TestUser = {
  id: string;
  companyId: string;
  email: string;
};

type EndpointCase = {
  label: string;
  method: HttpMethod;
  path: string;
  body?: unknown;
  expectedSuperStatuses: number[];
  capture?: (body: unknown) => void;
};

async function main() {
  const suffix = randomUUID().slice(0, 8);
  currentPhase = "environment setup";
  const previousJwtSecret = process.env.JWT_SECRET;
  const previousJwtExpiresIn = process.env.JWT_EXPIRES_IN;
  const jwtSecret = `platform-security-${suffix}`;
  process.env.JWT_SECRET = jwtSecret;
  process.env.JWT_EXPIRES_IN = "15m";

  const jwt = new JwtService({ secret: jwtSecret });
  currentPhase = "create app";
  const app = await createApp();
  currentPhase = "listen";
  const baseUrl = await listen(app);
  currentPhase = "cleanup stale security test data";
  await cleanupStaleSecurityData();
  currentPhase = "seed data";
  const seeded = await seedData(suffix);
  let createdSwitchToken: string | undefined;
  currentPhase = "sign seeded switch token";
  const endedSwitchToken = await signSwitchToken(jwt, seeded.superAdmin, seeded.seededSwitchSession.id, seeded.switchEndCompany.id, seeded.platformCompany.id);

  try {
    currentPhase = "sign user tokens";
    const tokens = {
      superAdmin: await signToken(jwt, seeded.superAdmin),
      companyAdmin: await signToken(jwt, seeded.companyAdmin),
      manager: await signToken(jwt, seeded.manager),
      employee: await signToken(jwt, seeded.employee),
      platformReadOnly: await signToken(jwt, seeded.platformReadOnly),
      platformManageOnly: await signToken(jwt, seeded.platformManageOnly),
      analyticsOnly: await signToken(jwt, seeded.analyticsOnly),
      subscriptionsOnly: await signToken(jwt, seeded.subscriptionsOnly),
      suspendedEmployee: await signToken(jwt, seeded.suspendedEmployee),
      invalid: "not-a-valid-jwt",
      expired: await jwt.signAsync({ sub: seeded.superAdmin.id, exp: Math.floor(Date.now() / 1000) - 60 })
    };

    const endpoints: EndpointCase[] = [
      { label: "list companies", method: "GET", path: "/api/v1/platform/companies", expectedSuperStatuses: [200] },
      { label: "get company", method: "GET", path: `/api/v1/platform/companies/${seeded.tenantCompany.id}`, expectedSuperStatuses: [200] },
      {
        label: "suspend company",
        method: "POST",
        path: `/api/v1/platform/companies/${seeded.companyLifecycleTarget.id}/suspend`,
        body: { reason: "security regression" },
        expectedSuperStatuses: [201]
      },
      {
        label: "activate company",
        method: "POST",
        path: `/api/v1/platform/companies/${seeded.companyLifecycleTarget.id}/activate`,
        body: { reason: "security regression" },
        expectedSuperStatuses: [201]
      },
      { label: "list plans", method: "GET", path: "/api/v1/platform/plans", expectedSuperStatuses: [200] },
      {
        label: "create plan",
        method: "POST",
        path: "/api/v1/platform/plans",
        body: {
          code: `security-extra-${suffix}`,
          name: "Security Extra",
          tier: CompanyPlan.PROFESSIONAL,
          monthlyPrice: 49,
          yearlyPrice: 490,
          currency: "USD"
        },
        expectedSuperStatuses: [201]
      },
      { label: "list subscriptions", method: "GET", path: "/api/v1/platform/subscriptions", expectedSuperStatuses: [200] },
      {
        label: "create subscription",
        method: "POST",
        path: "/api/v1/platform/subscriptions",
        body: {
          companyId: seeded.subscriptionTargetCompany.id,
          planId: seeded.plan.id,
          status: SubscriptionStatus.TRIALING,
          billingInterval: BillingInterval.MONTHLY,
          seats: 3
        },
        expectedSuperStatuses: [201]
      },
      {
        label: "update subscription",
        method: "PATCH",
        path: `/api/v1/platform/subscriptions/${seeded.subscription.id}`,
        body: { seats: 8, status: SubscriptionStatus.ACTIVE },
        expectedSuperStatuses: [200]
      },
      {
        label: "create switch session",
        method: "POST",
        path: "/api/v1/platform/switch-company",
        body: { companyId: seeded.switchCreateCompany.id, reason: "security regression" },
        expectedSuperStatuses: [201],
        capture: (body) => {
          createdSwitchToken = readString(body, "token");
        }
      },
      {
        label: "end switch session",
        method: "POST",
        path: `/api/v1/platform/switch-company/${seeded.seededSwitchSession.id}/end`,
        expectedSuperStatuses: [201]
      },
      { label: "list switch sessions", method: "GET", path: "/api/v1/platform/switch-sessions", expectedSuperStatuses: [200] },
      { label: "analytics overview", method: "GET", path: "/api/v1/platform/analytics/overview", expectedSuperStatuses: [200] },
      { label: "analytics usage", method: "GET", path: "/api/v1/platform/analytics/usage?range=7d", expectedSuperStatuses: [200] },
      { label: "analytics top companies", method: "GET", path: "/api/v1/platform/analytics/top-companies", expectedSuperStatuses: [200] },
      { label: "analytics subscription distribution", method: "GET", path: "/api/v1/platform/analytics/subscription-distribution", expectedSuperStatuses: [200] },
      { label: "list platform settings", method: "GET", path: "/api/v1/platform/settings", expectedSuperStatuses: [200] },
      {
        label: "update platform setting",
        method: "PATCH",
        path: `/api/v1/platform/settings/security-${suffix}`,
        body: { value: "enabled" },
        expectedSuperStatuses: [200]
      }
    ];

    currentPhase = "assert Swagger paths";
    assertSwaggerPaths(app, endpoints);
    currentPhase = "assert authentication failures";
    await assertAuthenticationFailures(baseUrl, endpoints[0], tokens.invalid, tokens.expired);
    currentPhase = "assert tenant users denied";
    await assertTenantUsersDenied(baseUrl, endpoints, [tokens.companyAdmin, tokens.manager, tokens.employee]);
    currentPhase = "assert Super Admin allowed";
    await assertSuperAdminAllowed(baseUrl, endpoints, tokens.superAdmin);

    currentPhase = "assert explicit platform permissions";
    await expectStatus(baseUrl, { label: "platform:read is required", method: "GET", path: "/api/v1/platform/analytics/overview" }, tokens.analyticsOnly, [403]);
    await expectStatus(baseUrl, { label: "analytics:read is required", method: "GET", path: "/api/v1/platform/analytics/overview" }, tokens.platformReadOnly, [403]);
    await expectStatus(baseUrl, { label: "platform:manage is required", method: "POST", path: "/api/v1/platform/plans", body: endpoints[5].body }, tokens.subscriptionsOnly, [403]);
    await expectStatus(baseUrl, { label: "subscriptions:manage is required", method: "POST", path: "/api/v1/platform/plans", body: endpoints[5].body }, tokens.platformManageOnly, [403]);
    await expectStatus(
      baseUrl,
      {
        label: "companies:suspend is required",
        method: "POST",
        path: `/api/v1/platform/companies/${seeded.tenantCompany.id}/suspend`,
        body: { reason: "missing lifecycle permission" }
      },
      tokens.platformManageOnly,
      [403]
    );
    await expectStatus(
      baseUrl,
      {
        label: "tenant_switch:execute is required",
        method: "POST",
        path: "/api/v1/platform/switch-company",
        body: { companyId: seeded.tenantCompany.id }
      },
      tokens.platformManageOnly,
      [403]
    );

    currentPhase = "assert switch and suspended tenant behavior";
    assert.ok(createdSwitchToken, "Super Admin switch endpoint should return an impersonation token");
    await expectStatus(baseUrl, { label: "active switch token works through auth", method: "GET", path: "/api/v1/auth/me" }, createdSwitchToken, [200]);
    await expectStatus(baseUrl, { label: "ended switch token is rejected", method: "GET", path: "/api/v1/auth/me" }, endedSwitchToken, [401]);
    await expectStatus(baseUrl, { label: "suspended tenant is blocked", method: "GET", path: "/api/v1/auth/me" }, tokens.suspendedEmployee, [403]);
    await expectStatus(
      baseUrl,
      {
        label: "suspended switch target is rejected",
        method: "POST",
        path: "/api/v1/platform/switch-company",
        body: { companyId: seeded.suspendedCompany.id }
      },
      tokens.superAdmin,
      [409]
    );

    console.log("Platform security endpoint assertions passed for authentication, authorization, route versioning, platform permissions, tenant users, switch tokens, and suspended tenants.");
  } finally {
    await app.close();
    await cleanup(seeded.companyIds, suffix);
    await prisma.$disconnect();
    restoreEnv("JWT_SECRET", previousJwtSecret);
    restoreEnv("JWT_EXPIRES_IN", previousJwtExpiresIn);
  }
}

async function createApp() {
  const app = await NestFactory.create(PlatformSecurityTestModule, { abortOnError: false, logger: ["error"] });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  return app;
}

async function listen(app: INestApplication) {
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function seedData(suffix: string) {
  const [platformCompany, tenantCompany, companyLifecycleTarget, subscriptionTargetCompany, switchCreateCompany, switchEndCompany, suspendedCompany, subscriptionsOnlyCompany] =
    await Promise.all([
      prisma.company.create({ data: { name: `Security Platform ${suffix}`, slug: `security-platform-${suffix}`, status: CompanyStatus.ACTIVE } }),
      prisma.company.create({ data: { name: `Security Tenant ${suffix}`, slug: `security-tenant-${suffix}`, status: CompanyStatus.ACTIVE } }),
      prisma.company.create({ data: { name: `Security Lifecycle ${suffix}`, slug: `security-lifecycle-${suffix}`, status: CompanyStatus.ACTIVE } }),
      prisma.company.create({ data: { name: `Security Subscription Target ${suffix}`, slug: `security-sub-target-${suffix}`, status: CompanyStatus.ACTIVE } }),
      prisma.company.create({ data: { name: `Security Switch Create ${suffix}`, slug: `security-switch-create-${suffix}`, status: CompanyStatus.ACTIVE } }),
      prisma.company.create({ data: { name: `Security Switch End ${suffix}`, slug: `security-switch-end-${suffix}`, status: CompanyStatus.ACTIVE } }),
      prisma.company.create({
        data: {
          name: `Security Suspended ${suffix}`,
          slug: `security-suspended-${suffix}`,
          status: CompanyStatus.SUSPENDED,
          suspendedAt: new Date()
        }
      }),
      prisma.company.create({ data: { name: `Security Subscriptions Only ${suffix}`, slug: `security-sub-only-${suffix}`, status: CompanyStatus.ACTIVE } })
    ]);
  const companyIds = [
    platformCompany.id,
    tenantCompany.id,
    companyLifecycleTarget.id,
    subscriptionTargetCompany.id,
    switchCreateCompany.id,
    switchEndCompany.id,
    suspendedCompany.id,
    subscriptionsOnlyCompany.id
  ];
  const [
    superAdmin,
    platformReadOnly,
    platformManageOnly,
    analyticsOnly,
    companyAdmin,
    manager,
    employee,
    suspendedEmployee,
    subscriptionsOnly
  ] = await Promise.all([
    createUser(platformCompany.id, `security-super-${suffix}@example.com`, "Security Super Admin"),
    createUser(platformCompany.id, `security-platform-read-${suffix}@example.com`, "Security Platform Read"),
    createUser(platformCompany.id, `security-platform-manage-${suffix}@example.com`, "Security Platform Manage"),
    createUser(platformCompany.id, `security-analytics-only-${suffix}@example.com`, "Security Analytics Only"),
    createUser(tenantCompany.id, `security-company-admin-${suffix}@example.com`, "Security Company Admin"),
    createUser(tenantCompany.id, `security-manager-${suffix}@example.com`, "Security Manager"),
    createUser(tenantCompany.id, `security-employee-${suffix}@example.com`, "Security Employee"),
    createUser(suspendedCompany.id, `security-suspended-employee-${suffix}@example.com`, "Security Suspended Employee"),
    createUser(subscriptionsOnlyCompany.id, `security-subscriptions-only-${suffix}@example.com`, "Security Subscriptions Only")
  ]);

  await seedAccess(platformCompany.id, superAdmin.id, SystemRole.SUPER_ADMIN, [
    PERMISSIONS.platformRead,
    PERMISSIONS.platformManage,
    PERMISSIONS.analyticsRead,
    PERMISSIONS.companiesSuspend,
    PERMISSIONS.subscriptionsRead,
    PERMISSIONS.subscriptionsManage,
    PERMISSIONS.tenantSwitchExecute
  ]);
  await seedAccess(platformCompany.id, platformReadOnly.id, SystemRole.COMPANY_ADMIN, [PERMISSIONS.platformRead]);
  await seedAccess(platformCompany.id, platformManageOnly.id, SystemRole.MANAGER, [PERMISSIONS.platformManage]);
  await seedAccess(platformCompany.id, analyticsOnly.id, SystemRole.EMPLOYEE, [PERMISSIONS.analyticsRead]);
  await seedAccess(tenantCompany.id, companyAdmin.id, SystemRole.COMPANY_ADMIN, []);
  await seedAccess(tenantCompany.id, manager.id, SystemRole.MANAGER, []);
  await seedAccess(tenantCompany.id, employee.id, SystemRole.EMPLOYEE, []);
  await seedAccess(suspendedCompany.id, suspendedEmployee.id, SystemRole.EMPLOYEE, []);
  await seedAccess(subscriptionsOnlyCompany.id, subscriptionsOnly.id, SystemRole.COMPANY_ADMIN, [PERMISSIONS.subscriptionsManage]);

  const plan = await prisma.subscriptionPlan.create({
    data: {
      code: `security-plan-${suffix}`,
      name: "Security Plan",
      tier: CompanyPlan.PROFESSIONAL,
      monthlyPrice: 99,
      yearlyPrice: 990,
      currency: "USD"
    }
  });
  const subscription = await prisma.companySubscription.create({
    data: {
      companyId: tenantCompany.id,
      planId: plan.id,
      status: SubscriptionStatus.TRIALING,
      billingInterval: BillingInterval.MONTHLY,
      seats: 5
    }
  });
  const seededSwitchSession = await prisma.companySwitchSession.create({
    data: {
      companyId: switchEndCompany.id,
      actorCompanyId: platformCompany.id,
      actorUserId: superAdmin.id,
      status: CompanySwitchStatus.ACTIVE,
      reason: "security regression",
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000)
    }
  });

  return {
    platformCompany,
    tenantCompany,
    companyLifecycleTarget,
    subscriptionTargetCompany,
    switchCreateCompany,
    switchEndCompany,
    suspendedCompany,
    superAdmin,
    platformReadOnly,
    platformManageOnly,
    analyticsOnly,
    subscriptionsOnly,
    companyAdmin,
    manager,
    employee,
    suspendedEmployee,
    plan,
    subscription,
    seededSwitchSession,
    companyIds
  };
}

async function createUser(companyId: string, email: string, name: string): Promise<TestUser> {
  return prisma.user.create({
    data: {
      companyId,
      email,
      passwordHash: "test",
      name,
      status: UserStatus.ACTIVE
    },
    select: {
      id: true,
      companyId: true,
      email: true
    }
  });
}

async function seedAccess(companyId: string, userId: string, systemName: SystemRole, permissions: string[]) {
  const role = await prisma.role.create({
    data: {
      companyId,
      name: systemName.replaceAll("_", " "),
      systemName
    }
  });
  const permissionRecords = [];

  for (const permission of permissions) {
    const [subject, action] = permission.split(":");
    const existing = await prisma.permission.findFirst({
      where: { companyId, subject, action, deletedAt: null }
    });
    permissionRecords.push(
      existing ??
        (await prisma.permission.create({
          data: {
            companyId,
            subject,
            action
          }
        }))
    );
  }

  await prisma.userRole.create({ data: { companyId, userId, roleId: role.id } });

  if (permissionRecords.length) {
    await prisma.rolePermission.createMany({
      data: permissionRecords.map((permission) => ({
        companyId,
        roleId: role.id,
        permissionId: permission.id
      }))
    });
  }
}

async function signToken(jwt: JwtService, user: TestUser) {
  return jwt.signAsync({
    sub: user.id,
    companyId: user.companyId,
    email: user.email
  });
}

async function signSwitchToken(jwt: JwtService, user: TestUser, switchSessionId: string, actingCompanyId: string, originalCompanyId: string) {
  return jwt.signAsync({
    sub: user.id,
    platformAdmin: true,
    switchSessionId,
    actingCompanyId,
    originalCompanyId
  });
}

async function assertAuthenticationFailures(baseUrl: string, endpoint: EndpointCase, invalidToken: string, expiredToken: string) {
  await expectStatus(baseUrl, endpoint, undefined, [401]);
  await expectStatus(baseUrl, endpoint, invalidToken, [401]);
  await expectStatus(baseUrl, endpoint, expiredToken, [401]);
}

async function assertTenantUsersDenied(baseUrl: string, endpoints: EndpointCase[], tokens: string[]) {
  for (const endpoint of endpoints) {
    await expectStatus(baseUrl, endpoint, undefined, [401]);

    for (const token of tokens) {
      await expectStatus(baseUrl, endpoint, token, [403]);
    }
  }
}

async function assertSuperAdminAllowed(baseUrl: string, endpoints: EndpointCase[], token: string) {
  for (const endpoint of endpoints) {
    const response = await request(baseUrl, endpoint, token);
    assert.ok(
      endpoint.expectedSuperStatuses.includes(response.status),
      `${endpoint.label} expected Super Admin status ${endpoint.expectedSuperStatuses.join(", ")} but received ${response.status}: ${response.text}`
    );
    endpoint.capture?.(response.body);
  }
}

async function expectStatus(baseUrl: string, endpoint: Pick<EndpointCase, "label" | "method" | "path" | "body">, token: string | undefined, statuses: number[]) {
  const response = await request(baseUrl, endpoint, token);
  assert.ok(statuses.includes(response.status), `${endpoint.label} expected status ${statuses.join(", ")} but received ${response.status}: ${response.text}`);
}

async function request(baseUrl: string, endpoint: Pick<EndpointCase, "method" | "path" | "body">, token?: string) {
  const headers: Record<string, string> = {};

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  if (endpoint.body !== undefined) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${endpoint.path}`, {
    method: endpoint.method,
    headers,
    body: endpoint.body === undefined ? undefined : JSON.stringify(endpoint.body)
  });
  const text = await response.text();

  return {
    status: response.status,
    text,
    body: text ? parseJson(text) : undefined
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function assertSwaggerPaths(app: INestApplication, endpoints: EndpointCase[]) {
  const config = new DocumentBuilder().setTitle("TASK Flow API").setVersion("0.1.0").addBearerAuth().build();
  const document = SwaggerModule.createDocument(app, config, { ignoreGlobalPrefix: false });
  const paths = new Set(Object.keys(document.paths));

  for (const endpoint of endpoints) {
    const normalized = endpoint.path.split("?")[0].replace(/\/[0-9a-f-]{36}(?=\/|$)/gi, "/{id}").replace(/\/security-[^/]+$/u, "/{id}");
    const swaggerPath = normalized.replace("/switch-company/{id}/end", "/switch-company/{sessionId}/end");
    assert.ok(paths.has(swaggerPath), `${endpoint.label} missing from Swagger paths as ${swaggerPath}`);
  }
}

function readString(body: unknown, key: string) {
  if (typeof body !== "object" || body === null || !(key in body)) {
    throw new Error(`Expected response body to contain ${key}`);
  }
  const value = (body as Record<string, unknown>)[key];

  if (typeof value !== "string") {
    throw new Error(`Expected response body field ${key} to be a string`);
  }

  return value;
}

async function cleanup(companyIds: string[], suffix: string) {
  await cleanupCompanyRecords(companyIds);
  await prisma.subscriptionPlan.deleteMany({
    where: {
      code: {
        in: [`security-plan-${suffix}`, `security-extra-${suffix}`]
      }
    }
  });
}

async function cleanupStaleSecurityData() {
  const companies = await prisma.company.findMany({
    where: { slug: { startsWith: "security-" } },
    select: { id: true }
  });
  await cleanupCompanyRecords(companies.map((company) => company.id));
  await prisma.subscriptionPlan.deleteMany({ where: { code: { startsWith: "security-" } } });
}

async function cleanupCompanyRecords(companyIds: string[]) {
  if (!companyIds.length) {
    return;
  }

  await prisma.companySwitchSession.deleteMany({ where: { OR: [{ companyId: { in: companyIds } }, { actorCompanyId: { in: companyIds } }] } });
  await prisma.subscriptionInvoice.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.companySubscription.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.auditLog.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.rolePermission.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.userRole.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.permission.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.role.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

void main().catch(async (error) => {
  console.error(`Platform security test failed during phase: ${currentPhase}`);
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
