import { EntityType, LeaveStatus, NotificationType, SystemRole, UserStatus } from "@prisma/client";
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
      name: `Leave Tenant ${suffix}`,
      slug: `leave-tenant-${suffix}`
    }
  });

  try {
    const [managerRole, adminRole] = await Promise.all([
      prisma.role.create({
        data: {
          companyId: company.id,
          name: "Manager",
          systemName: SystemRole.MANAGER
        }
      }),
      prisma.role.create({
        data: {
          companyId: company.id,
          name: "Company Admin",
          systemName: SystemRole.COMPANY_ADMIN
        }
      })
    ]);
    const [employee, manager, admin] = await Promise.all([
      prisma.user.create({
        data: {
          companyId: company.id,
          email: `employee-${suffix}@example.com`,
          passwordHash: "test",
          name: "Leave Employee",
          status: UserStatus.ACTIVE
        }
      }),
      prisma.user.create({
        data: {
          companyId: company.id,
          email: `manager-${suffix}@example.com`,
          passwordHash: "test",
          name: "Leave Manager",
          status: UserStatus.ACTIVE
        }
      }),
      prisma.user.create({
        data: {
          companyId: company.id,
          email: `admin-${suffix}@example.com`,
          passwordHash: "test",
          name: "Leave Admin",
          status: UserStatus.ACTIVE
        }
      })
    ]);

    const department = await prisma.department.create({
      data: {
        companyId: company.id,
        managerId: manager.id,
        name: "People",
        code: `PPL-${suffix}`
      }
    });

    await prisma.user.update({ where: { id: employee.id }, data: { departmentId: department.id } });
    await prisma.userRole.createMany({
      data: [
        { companyId: company.id, userId: manager.id, roleId: managerRole.id },
        { companyId: company.id, userId: admin.id, roleId: adminRole.id }
      ]
    });

    const leaveType = await leaveRequestsService.createType(company.id, {
      name: "Annual Leave",
      code: "ANNUAL",
      annualAllowanceDays: 21
    });
    const leave = await leaveRequestsService.create(company.id, employee.id, {
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      startsAt: "2026-07-10T00:00:00.000Z",
      endsAt: "2026-07-12T23:59:59.000Z",
      reason: "Family travel"
    });

    assert.equal(leave.status, LeaveStatus.PENDING);
    assert.equal(leave.approvalActions.length, 2);

    await waitFor(async () => {
      const notification = await prisma.notification.findFirst({
        where: { companyId: company.id, userId: manager.id, type: NotificationType.LEAVE_SUBMITTED, entityId: leave.id }
      });
      const search = await prisma.searchIndex.findFirst({
        where: { companyId: company.id, entityType: EntityType.LEAVE_REQUEST, entityId: leave.id, deletedAt: null }
      });
      return Boolean(notification && search?.content.includes("Annual Leave"));
    });

    const comment = await leaveRequestsService.addComment(company.id, manager.id, leave.id, { content: "Coverage confirmed." });
    assert.equal(comment.entityType, EntityType.LEAVE_REQUEST);

    const attachment = await leaveRequestsService.addAttachment(company.id, employee.id, leave.id, {
      fileName: "handover.pdf",
      filePath: "/leave/handover.pdf",
      mimeType: "application/pdf",
      fileSize: 2048
    });
    assert.equal(attachment.filePath, "leave/handover.pdf");

    const infoRequested = await leaveRequestsService.requestMoreInformation(company.id, manager.id, leave.id, { comment: "Please add handover notes." });
    assert.equal(infoRequested.status, LeaveStatus.INFO_REQUESTED);

    await waitFor(async () => {
      const notification = await prisma.notification.findFirst({
        where: { companyId: company.id, userId: employee.id, type: NotificationType.LEAVE_INFO_REQUESTED, entityId: leave.id }
      });
      return Boolean(notification);
    });

    const resubmitted = await leaveRequestsService.update(company.id, employee.id, leave.id, { reason: "Family travel with handover notes attached." });
    assert.equal(resubmitted.status, LeaveStatus.PENDING);

    const afterManager = await leaveRequestsService.approve(company.id, manager.id, leave.id, { comment: "Approved by manager" });
    assert.equal(afterManager.status, LeaveStatus.PENDING);

    await waitFor(async () => {
      const notification = await prisma.notification.findFirst({
        where: { companyId: company.id, userId: admin.id, type: NotificationType.LEAVE_SUBMITTED, entityId: leave.id }
      });
      return Boolean(notification);
    });

    const approved = await leaveRequestsService.approve(company.id, admin.id, leave.id, { comment: "Approved by admin" });
    assert.equal(approved.status, LeaveStatus.APPROVED);
    assert.ok(approved.approvedAt);

    const balance = await prisma.leaveBalance.findFirstOrThrow({
      where: { companyId: company.id, employeeId: employee.id, leaveTypeId: leaveType.id, year: 2026 }
    });
    assert.equal(Number(balance.usedDays), 3);
    assert.equal(Number(balance.remainingDays), 18);

    await waitFor(async () => {
      const notification = await prisma.notification.findFirst({
        where: { companyId: company.id, userId: employee.id, type: NotificationType.LEAVE_APPROVED, entityId: leave.id }
      });
      const activityCount = await prisma.activity.count({
        where: {
          companyId: company.id,
          metadata: {
            path: ["leaveRequestId"],
            equals: leave.id
          }
        }
      });
      return Boolean(notification) && activityCount >= 5;
    });

    const history = await leaveRequestsService.history(company.id, leave.id);
    assert.equal(history.approvalActions.length, 2);
    assert.ok(history.comments.length >= 1);
    assert.ok(history.attachments.length >= 1);

    console.log("Leave request assertions passed for workflow, events, notifications, comments, attachments, and search.");
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

  throw new Error("Timed out waiting for async leave event side effect");
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
