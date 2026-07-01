import { EntityType, LeaveApprovalMode, LeaveDurationType, LeaveHalfDayPeriod, LeaveStatus, SystemRole, UserStatus } from "@prisma/client";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ApprovalWorkflowsService } from "../../approval-workflows/approval-workflows.service";
import { AttachmentsService } from "../../attachments/attachments.service";
import { CommentsService } from "../../comments/comments.service";
import { DomainEventBus } from "../../domain-events/domain-event-bus.service";
import { PrismaService } from "../../prisma/prisma.service";
import { SearchIndexer } from "../../search/search-indexer.service";
import { StorageProvider } from "../../storage/storage-provider";
import { LeaveEventsHandler } from "../events/leave-events.handler";
import { LeaveRequestsService } from "../leave-requests.service";

const storage: StorageProvider = {
  normalizeKey: (key) => key.replace(/^\/+/, ""),
  getObjectUrl: async (key) => `local://${key}`
};

const prisma = new PrismaService();

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const eventBus = new DomainEventBus();
  const searchIndexer = new SearchIndexer(prisma);
  const approvalWorkflows = new ApprovalWorkflowsService(prisma);
  const commentsService = new CommentsService(prisma);
  const attachmentsService = new AttachmentsService(prisma, storage);
  const leaveRequestsService = new LeaveRequestsService(prisma, eventBus, approvalWorkflows, commentsService, attachmentsService);
  const leaveEventsHandler = new LeaveEventsHandler(eventBus, prisma, searchIndexer, approvalWorkflows);

  leaveEventsHandler.onModuleInit();

  const company = await prisma.company.create({
    data: {
      name: `Leave Enhancements ${suffix}`,
      slug: `leave-enhancements-${suffix}`
    }
  });

  try {
    const [managerRole, adminRole] = await Promise.all([
      prisma.role.create({
        data: { companyId: company.id, name: "Manager", systemName: SystemRole.MANAGER }
      }),
      prisma.role.create({
        data: { companyId: company.id, name: "Company Admin", systemName: SystemRole.COMPANY_ADMIN }
      })
    ]);
    const [employee, manager] = await Promise.all([
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
          email: `manager-${suffix}@example.com`,
          passwordHash: "test",
          name: "Balance Manager",
          status: UserStatus.ACTIVE
        }
      })
    ]);
    const department = await prisma.department.create({
      data: {
        companyId: company.id,
        managerId: manager.id,
        name: "HR",
        code: `HR-${suffix}`
      }
    });

    await prisma.user.update({ where: { id: employee.id }, data: { departmentId: department.id } });
    await prisma.userRole.createMany({
      data: [
        { companyId: company.id, userId: manager.id, roleId: managerRole.id },
        { companyId: company.id, userId: manager.id, roleId: adminRole.id }
      ]
    });

    const configured = await leaveRequestsService.updateSettings(company.id, { approvalMode: LeaveApprovalMode.MANAGER_ONLY });
    assert.equal(configured.setting.approvalMode, LeaveApprovalMode.MANAGER_ONLY);
    assert.equal(configured.workflow.steps.length, 1);

    const leaveType = await leaveRequestsService.createType(company.id, {
      name: "Annual Leave",
      code: "ANNUAL",
      annualAllowanceDays: 10
    });
    const openingBalance = await leaveRequestsService.upsertBalance(company.id, {
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      year: 2026,
      allocatedDays: 10,
      usedDays: 1
    });
    assert.equal(Number(openingBalance.remainingDays), 9);

    const leave = await leaveRequestsService.create(company.id, employee.id, {
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      startsAt: "2026-07-15T00:00:00.000Z",
      endsAt: "2026-07-15T00:00:00.000Z",
      durationType: LeaveDurationType.HALF_DAY,
      halfDayPeriod: LeaveHalfDayPeriod.AFTERNOON,
      reason: "Afternoon personal appointment"
    });
    assert.equal(Number(leave.durationDays), 0.5);
    assert.equal(leave.approvalActions.length, 1);

    const approved = await leaveRequestsService.approve(company.id, manager.id, leave.id, { comment: "Approved" });
    assert.equal(approved.status, LeaveStatus.APPROVED);

    const balance = await prisma.leaveBalance.findFirstOrThrow({
      where: { companyId: company.id, employeeId: employee.id, leaveTypeId: leaveType.id, year: 2026 }
    });
    assert.equal(Number(balance.usedDays), 1.5);
    assert.equal(Number(balance.remainingDays), 8.5);

    const calendar = await leaveRequestsService.calendar(company.id, {
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-31T23:59:59.000Z",
      departmentId: department.id
    });
    assert.equal(calendar.length, 1);
    assert.equal(calendar[0].id, leave.id);

    const availability = await leaveRequestsService.availability(company.id, {
      from: "2026-07-15T00:00:00.000Z",
      to: "2026-07-15T23:59:59.000Z",
      departmentId: department.id
    });
    assert.equal(availability.totalEmployees, 1);
    assert.equal(availability.onLeaveCount, 1);
    assert.equal(availability.availableCount, 0);

    console.log("Leave enhancement assertions passed for settings, balances, half-day approvals, calendar, and availability.");
  } finally {
    leaveEventsHandler.onModuleDestroy();
    await cleanup(company.id);
    await prisma.$disconnect();
  }
}

async function cleanup(companyId: string) {
  await prisma.notification.deleteMany({ where: { companyId } });
  await prisma.searchIndex.deleteMany({ where: { companyId } });
  await prisma.auditLog.deleteMany({ where: { companyId } });
  await prisma.activity.deleteMany({ where: { companyId } });
  await prisma.attachment.deleteMany({ where: { companyId } });
  await prisma.comment.deleteMany({ where: { companyId } });
  await prisma.approvalAction.deleteMany({ where: { companyId } });
  await prisma.approvalStep.deleteMany({ where: { companyId } });
  await prisma.approvalWorkflow.deleteMany({ where: { companyId } });
  await prisma.leaveRequest.deleteMany({ where: { companyId } });
  await prisma.leaveBalance.deleteMany({ where: { companyId } });
  await prisma.leaveSetting.deleteMany({ where: { companyId } });
  await prisma.leaveType.deleteMany({ where: { companyId } });
  await prisma.userRole.deleteMany({ where: { companyId } });
  await prisma.role.deleteMany({ where: { companyId } });
  await prisma.department.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
}

void main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
