import { EntityType, LeaveApprovalMode, LeaveRequestType, LeaveStatus, NotificationType, SystemRole, UserStatus } from "@prisma/client";
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
import { LeaveBalancesService } from "../leave-balances.service";
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
  const leaveBalancesService = new LeaveBalancesService(prisma, eventBus);
  const leaveRequestsService = new LeaveRequestsService(prisma, eventBus, approvalWorkflows, commentsService, attachmentsService, leaveBalancesService);
  const leaveEventsHandler = new LeaveEventsHandler(eventBus, prisma, searchIndexer, approvalWorkflows);

  leaveEventsHandler.onModuleInit();

  const company = await prisma.company.create({
    data: { name: `Permission Tenant ${suffix}`, slug: `permission-tenant-${suffix}` }
  });

  try {
    const [managerRole, adminRole] = await Promise.all([
      prisma.role.create({ data: { companyId: company.id, name: "Manager", systemName: SystemRole.MANAGER } }),
      prisma.role.create({ data: { companyId: company.id, name: "Company Admin", systemName: SystemRole.COMPANY_ADMIN } })
    ]);
    const [employee, manager] = await Promise.all([
      prisma.user.create({
        data: {
          companyId: company.id,
          email: `employee-${suffix}@example.com`,
          passwordHash: "test",
          name: "Permission Employee",
          status: UserStatus.ACTIVE
        }
      }),
      prisma.user.create({
        data: {
          companyId: company.id,
          email: `manager-${suffix}@example.com`,
          passwordHash: "test",
          name: "Permission Manager",
          status: UserStatus.ACTIVE
        }
      })
    ]);
    const department = await prisma.department.create({
      data: { companyId: company.id, name: "Operations", code: `OPS-${suffix}`, managerId: manager.id }
    });

    await prisma.user.update({ where: { id: employee.id }, data: { departmentId: department.id } });
    await prisma.userRole.createMany({
      data: [
        { companyId: company.id, userId: manager.id, roleId: managerRole.id },
        { companyId: company.id, userId: manager.id, roleId: adminRole.id }
      ]
    });
    await leaveRequestsService.updateSettings(company.id, { approvalMode: LeaveApprovalMode.MANAGER_ONLY });

    const permissionType = await leaveRequestsService.createType(company.id, {
      name: "Permission",
      code: "PERMISSION",
      annualAllowanceDays: 3
    });
    await leaveBalancesService.upsert(company.id, manager.id, {
      employeeId: employee.id,
      leaveTypeId: permissionType.id,
      year: 2026,
      allocatedDays: 3,
      usedDays: 0
    });

    const permission = await leaveRequestsService.create(company.id, employee.id, {
      employeeId: employee.id,
      leaveTypeId: permissionType.id,
      requestType: LeaveRequestType.PERMISSION,
      startsAt: "2026-07-20T10:00:00.000Z",
      endsAt: "2026-07-20T12:00:00.000Z",
      startTime: "2026-07-20T10:00:00.000Z",
      endTime: "2026-07-20T12:00:00.000Z",
      reason: "Doctor appointment"
    });

    assert.equal(permission.requestType, LeaveRequestType.PERMISSION);
    assert.equal(Number(permission.durationHours), 2);
    assert.equal(Number(permission.durationDays), 0.25);
    assert.ok(permission.requestNumber?.startsWith("PR-"));

    await waitFor(async () => {
      const audit = await prisma.auditLog.findFirst({ where: { companyId: company.id, action: "PERMISSION_REQUEST_SUBMITTED", entityId: permission.id } });
      const notification = await prisma.notification.findFirst({
        where: { companyId: company.id, userId: manager.id, type: NotificationType.LEAVE_SUBMITTED, entityId: permission.id }
      });
      return Boolean(audit && notification);
    });

    const approved = await leaveRequestsService.approve(company.id, manager.id, permission.id, { comment: "Approved" });
    assert.equal(approved.status, LeaveStatus.APPROVED);

    await waitFor(async () => {
      const audit = await prisma.auditLog.findFirst({ where: { companyId: company.id, action: "PERMISSION_REQUEST_APPROVED", entityId: permission.id } });
      const search = await prisma.searchIndex.findFirst({ where: { companyId: company.id, entityType: EntityType.LEAVE_REQUEST, entityId: permission.id } });
      return Boolean(audit && search?.title.includes(permission.requestNumber ?? "PR-"));
    });

    const balance = await prisma.leaveBalance.findFirstOrThrow({
      where: { companyId: company.id, employeeId: employee.id, leaveTypeId: permissionType.id, year: 2026 }
    });
    assert.equal(Number(balance.usedDays), 0.25);
    assert.equal(Number(balance.remainingDays), 2.75);

    console.log("Hourly permission assertions passed for submission, approval, events, search, and balance deduction.");
  } finally {
    leaveEventsHandler.onModuleDestroy();
    await cleanup(company.id);
    await prisma.$disconnect();
  }
}

async function waitFor(predicate: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for permission side effect");
}

async function cleanup(companyId: string) {
  await prisma.notification.deleteMany({ where: { companyId } });
  await prisma.searchIndex.deleteMany({ where: { companyId } });
  await prisma.auditLog.deleteMany({ where: { companyId } });
  await prisma.activity.deleteMany({ where: { companyId } });
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
