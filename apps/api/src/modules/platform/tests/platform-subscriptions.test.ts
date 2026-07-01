import { BillingInterval, CompanyPlan, CompanyStatus, SubscriptionInvoiceStatus, SubscriptionStatus, UserStatus } from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PERMISSIONS } from "../../../common/constants";
import { DomainEventBus } from "../../../domain-events/domain-event-bus.service";
import { DomainEvent } from "../../../domain-events/domain-event";
import { PrismaService } from "../../../prisma/prisma.service";
import { PLATFORM_EVENTS } from "../platform.events";
import { PlatformService } from "../platform.service";

const prisma = new PrismaService();

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const eventBus = new DomainEventBus();
  const platformService = new PlatformService(prisma, eventBus, { signAsync: async () => "switch-token" } as unknown as JwtService);
  const events: DomainEvent[] = [];
  const eventSubscription = eventBus.events$.subscribe((event) => events.push(event));
  const [platformCompany, companyA, companyB] = await Promise.all([
    prisma.company.create({ data: { name: `Billing Platform ${suffix}`, slug: `billing-platform-${suffix}`, status: CompanyStatus.ACTIVE } }),
    prisma.company.create({ data: { name: `Billing Tenant A ${suffix}`, slug: `billing-a-${suffix}`, status: CompanyStatus.TRIAL } }),
    prisma.company.create({ data: { name: `Billing Tenant B ${suffix}`, slug: `billing-b-${suffix}`, status: CompanyStatus.TRIAL } })
  ]);

  try {
    const actor = await prisma.user.create({
      data: {
        companyId: platformCompany.id,
        email: `billing-admin-${suffix}@example.com`,
        passwordHash: "test",
        name: "Billing Admin",
        status: UserStatus.ACTIVE
      }
    });

    assert.equal(PERMISSIONS.subscriptionsRead, "subscriptions:read");
    assert.equal(PERMISSIONS.subscriptionsManage, "subscriptions:manage");

    const businessPlan = await platformService.createPlan(platformCompany.id, actor.id, {
      code: `Business-${suffix}`,
      name: "Business",
      tier: CompanyPlan.PROFESSIONAL,
      monthlyPrice: 99,
      yearlyPrice: 990,
      currency: "usd",
      maxUsers: 100,
      maxStorageMb: 102400,
      features: { emailCenter: true, advancedSearch: true }
    });
    assert.equal(businessPlan.code, `business-${suffix}`);
    assert.equal(businessPlan.currency, "USD");
    assert.equal(businessPlan.tier, CompanyPlan.PROFESSIONAL);

    const planAudit = await prisma.auditLog.findFirst({
      where: { companyId: platformCompany.id, actorId: actor.id, action: "SUBSCRIPTION_PLAN_CREATED", entityId: businessPlan.id }
    });
    assert.ok(planAudit);

    await assert.rejects(
      () =>
        platformService.createPlan(platformCompany.id, actor.id, {
          code: `business-${suffix}`,
          name: "Duplicate"
        }),
      /already exists/
    );

    const inactivePlan = await platformService.createPlan(platformCompany.id, actor.id, {
      code: `inactive-${suffix}`,
      name: "Inactive",
      isActive: false
    });

    const planList = await platformService.listPlans({ search: suffix, tier: CompanyPlan.PROFESSIONAL, isActive: true, page: 1, limit: 10 });
    assert.equal(planList.meta.total, 1);
    assert.equal(planList.data[0].id, businessPlan.id);

    await assert.rejects(
      () =>
        platformService.createSubscription(actor.id, {
          companyId: companyA.id,
          planId: inactivePlan.id
        }),
      /Subscription plan not found/
    );

    const subscriptionA = await platformService.createSubscription(actor.id, {
      companyId: companyA.id,
      planId: businessPlan.id,
      status: SubscriptionStatus.TRIALING,
      billingInterval: BillingInterval.MONTHLY,
      seats: 12,
      startsAt: "2026-07-01T00:00:00.000Z",
      trialEndsAt: "2026-07-31T23:59:59.000Z",
      currentPeriodEnd: "2026-07-31T23:59:59.000Z",
      metadata: { source: "manual" }
    });
    assert.equal(subscriptionA.companyId, companyA.id);
    assert.equal(subscriptionA.planId, businessPlan.id);
    assert.equal(subscriptionA.status, SubscriptionStatus.TRIALING);
    assert.equal(subscriptionA.billingInterval, BillingInterval.MONTHLY);
    assert.equal(subscriptionA.seats, 12);
    assert.equal(subscriptionA._count.invoices, 0);

    const updatedCompanyA = await prisma.company.findUniqueOrThrow({ where: { id: companyA.id } });
    assert.equal(updatedCompanyA.plan, CompanyPlan.PROFESSIONAL);
    assert.ok(updatedCompanyA.trialEndsAt);

    await prisma.subscriptionInvoice.create({
      data: {
        companyId: companyA.id,
        subscriptionId: subscriptionA.id,
        invoiceNumber: `INV-${suffix}`,
        status: SubscriptionInvoiceStatus.OPEN,
        currency: "USD",
        amountDue: 99
      }
    });

    const subscriptionB = await platformService.createSubscription(actor.id, {
      companyId: companyB.id,
      planId: businessPlan.id,
      status: SubscriptionStatus.ACTIVE,
      billingInterval: BillingInterval.YEARLY,
      seats: 5
    });

    const createdAudit = await prisma.auditLog.findFirst({
      where: { companyId: companyA.id, actorId: actor.id, action: "SUBSCRIPTION_CREATED", entityId: subscriptionA.id }
    });
    assert.ok(createdAudit);
    assert.ok(events.some((event) => event.name === PLATFORM_EVENTS.subscriptionCreated && event.companyId === companyA.id && event.entityId === subscriptionA.id));

    const companySubscriptions = await platformService.listSubscriptions({ companyId: companyA.id, status: SubscriptionStatus.TRIALING, page: 1, limit: 10 });
    assert.equal(companySubscriptions.meta.total, 1);
    assert.equal(companySubscriptions.data[0].id, subscriptionA.id);
    assert.equal(companySubscriptions.data[0]._count.invoices, 1);
    assert.ok(!companySubscriptions.data.some((subscription) => subscription.id === subscriptionB.id));

    const enterprisePlan = await platformService.createPlan(platformCompany.id, actor.id, {
      code: `enterprise-${suffix}`,
      name: "Enterprise",
      tier: CompanyPlan.ENTERPRISE,
      monthlyPrice: 299,
      yearlyPrice: 2990,
      features: { advancedReports: true }
    });

    const updated = await platformService.updateSubscription(subscriptionA.id, actor.id, {
      planId: enterprisePlan.id,
      status: SubscriptionStatus.ACTIVE,
      billingInterval: BillingInterval.YEARLY,
      seats: 25,
      currentPeriodEnd: "2027-07-01T00:00:00.000Z",
      metadata: { upgradedBy: "platform" }
    });
    assert.equal(updated.planId, enterprisePlan.id);
    assert.equal(updated.status, SubscriptionStatus.ACTIVE);
    assert.equal(updated.billingInterval, BillingInterval.YEARLY);
    assert.equal(updated.seats, 25);
    assert.equal(updated.plan.tier, CompanyPlan.ENTERPRISE);

    const companyAfterUpgrade = await prisma.company.findUniqueOrThrow({ where: { id: companyA.id } });
    assert.equal(companyAfterUpgrade.plan, CompanyPlan.ENTERPRISE);

    const updatedAudit = await prisma.auditLog.findFirst({
      where: { companyId: companyA.id, actorId: actor.id, action: "SUBSCRIPTION_UPDATED", entityId: subscriptionA.id }
    });
    assert.ok(updatedAudit);
    assert.ok(events.some((event) => event.name === PLATFORM_EVENTS.subscriptionUpdated && event.companyId === companyA.id && event.entityId === subscriptionA.id));

    const cancelled = await platformService.updateSubscription(subscriptionA.id, actor.id, {
      status: SubscriptionStatus.CANCELLED
    });
    assert.equal(cancelled.status, SubscriptionStatus.CANCELLED);
    assert.ok(cancelled.cancelledAt);

    await assert.rejects(() => platformService.updateSubscription(randomUUID(), actor.id, { status: SubscriptionStatus.EXPIRED }), /Subscription not found/);

    console.log("Platform subscription assertions passed for plan creation, filtering, subscription create/update/cancel, invoice counts, tenant isolation, audit logs, and events.");
  } finally {
    eventSubscription.unsubscribe();
    await cleanup([platformCompany.id, companyA.id, companyB.id], suffix);
    await prisma.$disconnect();
  }
}

async function cleanup(companyIds: string[], suffix: string) {
  await prisma.subscriptionInvoice.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.companySubscription.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.auditLog.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  await prisma.subscriptionPlan.deleteMany({ where: { code: { in: [`business-${suffix}`, `inactive-${suffix}`, `enterprise-${suffix}`] } } });
}

void main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
