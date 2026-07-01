import { SystemRole, UserStatus } from "@prisma/client";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ApprovalWorkflowsService } from "../../approval-workflows/approval-workflows.service";
import { DomainEventBus } from "../../domain-events/domain-event-bus.service";
import { PrismaService } from "../../prisma/prisma.service";
import { SearchIndexer } from "../../search/search-indexer.service";
import { LeaveEventsHandler } from "../events/leave-events.handler";
import { LeaveBalancesService } from "../leave-balances.service";

const prisma = new PrismaService();

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const eventBus = new DomainEventBus();
  const leaveBalancesService = new LeaveBalancesService(prisma, eventBus);
  const leaveEventsHandler = new LeaveEventsHandler(eventBus, prisma, new SearchIndexer(prisma), new ApprovalWorkflowsService(prisma));

  leaveEventsHandler.onModuleInit();

  const company = await prisma.company.create({
    data: { name: `Balance Tenant ${suffix}`, slug: `balance-tenant-${suffix}` }
  });

  try {
    const [employee, admin] = await Promise.all([
      prisma.user.create({
        data: {
          companyId: company.id,
          email: `employee-${suffix}@example.com`,
          passwordHash: "test",
          name: "Balance Employee",
          status: UserStatus.ACTIVE
        }
      }),
      prisma.user.create({
        data: {
          companyId: company.id,
          email: `admin-${suffix}@example.com`,
          passwordHash: "test",
          name: "Balance Admin",
          status: UserStatus.ACTIVE
        }
      })
    ]);
    await prisma.role.create({ data: { companyId: company.id, name: "Company Admin", systemName: SystemRole.COMPANY_ADMIN } });
    const leaveType = await prisma.leaveType.create({
      data: { companyId: company.id, name: "Annual Leave", code: "ANNUAL", annualAllowanceDays: 21 }
    });

    const created = await leaveBalancesService.upsert(company.id, admin.id, {
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      year: 2026,
      allocatedDays: 21,
      usedDays: 4
    });
    assert.equal(Number(created.remainingDays), 17);

    const updated = await leaveBalancesService.update(company.id, admin.id, created.id, { usedDays: 5.5 });
    assert.equal(Number(updated.usedDays), 5.5);
    assert.equal(Number(updated.remainingDays), 15.5);

    const mine = await leaveBalancesService.findMine(company.id, employee.id, { year: 2026 });
    assert.equal(mine.length, 1);
    assert.equal(mine[0].id, created.id);

    await waitFor(async () => {
      const allocated = await prisma.activity.findFirst({ where: { companyId: company.id, type: "LEAVE_ALLOCATED" } });
      const updatedActivity = await prisma.activity.findFirst({ where: { companyId: company.id, type: "LEAVE_BALANCE_UPDATED" } });
      const audit = await prisma.auditLog.findFirst({ where: { companyId: company.id, action: "LEAVE_BALANCE_UPDATED", entityType: "LEAVE_BALANCE" } });
      return Boolean(allocated && updatedActivity && audit);
    });

    await assert.rejects(
      () => leaveBalancesService.update(company.id, admin.id, created.id, { usedDays: 30 }),
      /Used leave days cannot exceed allocated days/
    );

    console.log("Leave balance assertions passed for allocation, recalculation, events, and validation.");
  } finally {
    leaveEventsHandler.onModuleDestroy();
    await cleanup(company.id);
    await prisma.$disconnect();
  }
}

async function waitFor(predicate: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for leave balance events");
}

async function cleanup(companyId: string) {
  await prisma.notification.deleteMany({ where: { companyId } });
  await prisma.searchIndex.deleteMany({ where: { companyId } });
  await prisma.auditLog.deleteMany({ where: { companyId } });
  await prisma.activity.deleteMany({ where: { companyId } });
  await prisma.leaveBalance.deleteMany({ where: { companyId } });
  await prisma.leaveType.deleteMany({ where: { companyId } });
  await prisma.userRole.deleteMany({ where: { companyId } });
  await prisma.role.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
}

void main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
