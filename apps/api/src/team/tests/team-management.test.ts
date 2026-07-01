import { EntityType, LeaveApprovalMode, LeaveStatus, SystemRole, TaskPriority, TaskStatus, UserStatus } from "@prisma/client";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ApprovalWorkflowsService } from "../../approval-workflows/approval-workflows.service";
import { AttachmentsService } from "../../attachments/attachments.service";
import { CommentsService } from "../../comments/comments.service";
import { PERMISSIONS } from "../../common/constants";
import { DomainEventBus } from "../../domain-events/domain-event-bus.service";
import { LeaveEventsHandler } from "../../leave-requests/events/leave-events.handler";
import { LeaveBalancesService } from "../../leave-requests/leave-balances.service";
import { LeaveRequestsService } from "../../leave-requests/leave-requests.service";
import { PrismaService } from "../../prisma/prisma.service";
import { SearchIndexer } from "../../search/search-indexer.service";
import { StorageProvider } from "../../storage/storage-provider";
import { TeamEventsHandler } from "../events/team-events.handler";
import { TeamService } from "../team.service";

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
  const teamService = new TeamService(prisma, leaveRequestsService, eventBus);
  const leaveEventsHandler = new LeaveEventsHandler(eventBus, prisma, searchIndexer, approvalWorkflows);
  const teamEventsHandler = new TeamEventsHandler(eventBus, prisma, searchIndexer);

  leaveEventsHandler.onModuleInit();
  teamEventsHandler.onModuleInit();

  const [companyA, companyB] = await Promise.all([
    prisma.company.create({ data: { name: `Team A ${suffix}`, slug: `team-a-${suffix}` } }),
    prisma.company.create({ data: { name: `Team B ${suffix}`, slug: `team-b-${suffix}` } })
  ]);

  try {
    assert.equal(PERMISSIONS.usersViewTeam, "users:view_team");
    assert.equal(PERMISSIONS.leaveRequestsApproveTeam, "leave_requests:approve_team");
    assert.equal(PERMISSIONS.tasksViewTeam, "tasks:view_team");

    const [managerRoleA, adminRoleA, managerRoleB, adminRoleB] = await Promise.all([
      prisma.role.create({ data: { companyId: companyA.id, name: "Manager", systemName: SystemRole.MANAGER } }),
      prisma.role.create({ data: { companyId: companyA.id, name: "Company Admin", systemName: SystemRole.COMPANY_ADMIN } }),
      prisma.role.create({ data: { companyId: companyB.id, name: "Manager", systemName: SystemRole.MANAGER } }),
      prisma.role.create({ data: { companyId: companyB.id, name: "Company Admin", systemName: SystemRole.COMPANY_ADMIN } })
    ]);
    const [managerA, otherManagerA, employeeA, peerEmployeeA, managerB, employeeB] = await Promise.all([
      createUser(companyA.id, `manager-a-${suffix}@example.com`, "Manager A"),
      createUser(companyA.id, `other-manager-a-${suffix}@example.com`, "Other Manager A"),
      createUser(companyA.id, `employee-a-${suffix}@example.com`, "Employee A"),
      createUser(companyA.id, `peer-a-${suffix}@example.com`, "Peer Employee A"),
      createUser(companyB.id, `manager-b-${suffix}@example.com`, "Manager B"),
      createUser(companyB.id, `employee-b-${suffix}@example.com`, "Employee B")
    ]);
    const [departmentA, departmentB] = await Promise.all([
      prisma.department.create({ data: { companyId: companyA.id, name: "People", code: `PPL-${suffix}`, managerId: managerA.id } }),
      prisma.department.create({ data: { companyId: companyB.id, name: "People", code: `PPL-B-${suffix}`, managerId: managerB.id } })
    ]);

    await Promise.all([
      prisma.user.update({ where: { id: managerA.id }, data: { departmentId: departmentA.id } }),
      prisma.user.update({ where: { id: otherManagerA.id }, data: { departmentId: departmentA.id } }),
      prisma.user.update({ where: { id: employeeA.id }, data: { departmentId: departmentA.id, managerId: managerA.id } }),
      prisma.user.update({ where: { id: peerEmployeeA.id }, data: { departmentId: departmentA.id, managerId: otherManagerA.id } }),
      prisma.user.update({ where: { id: employeeB.id }, data: { departmentId: departmentB.id, managerId: managerB.id } }),
      prisma.userRole.createMany({
        data: [
          { companyId: companyA.id, userId: managerA.id, roleId: managerRoleA.id },
          { companyId: companyA.id, userId: otherManagerA.id, roleId: managerRoleA.id },
          { companyId: companyA.id, userId: managerA.id, roleId: adminRoleA.id },
          { companyId: companyB.id, userId: managerB.id, roleId: managerRoleB.id },
          { companyId: companyB.id, userId: managerB.id, roleId: adminRoleB.id }
        ]
      })
    ]);

    await Promise.all([
      leaveRequestsService.updateSettings(companyA.id, { approvalMode: LeaveApprovalMode.MANAGER_ONLY }),
      leaveRequestsService.updateSettings(companyB.id, { approvalMode: LeaveApprovalMode.MANAGER_ONLY })
    ]);

    const [leaveTypeA, leaveTypeB] = await Promise.all([
      leaveRequestsService.createType(companyA.id, { name: "Annual Leave", code: "ANNUAL", annualAllowanceDays: 10 }),
      leaveRequestsService.createType(companyB.id, { name: "Annual Leave", code: "ANNUAL", annualAllowanceDays: 10 })
    ]);
    await leaveBalancesService.upsert(companyA.id, managerA.id, {
      employeeId: employeeA.id,
      leaveTypeId: leaveTypeA.id,
      year: 2026,
      allocatedDays: 10,
      usedDays: 0
    });

    const directLeave = await leaveRequestsService.create(companyA.id, employeeA.id, {
      employeeId: employeeA.id,
      leaveTypeId: leaveTypeA.id,
      startsAt: "2026-07-15T00:00:00.000Z",
      endsAt: "2026-07-15T23:59:59.000Z",
      reason: "Team coverage"
    });
    const peerLeave = await leaveRequestsService.create(companyA.id, peerEmployeeA.id, {
      employeeId: peerEmployeeA.id,
      leaveTypeId: leaveTypeA.id,
      startsAt: "2026-07-16T00:00:00.000Z",
      endsAt: "2026-07-16T23:59:59.000Z",
      reason: "Other team"
    });
    await leaveRequestsService.create(companyB.id, employeeB.id, {
      employeeId: employeeB.id,
      leaveTypeId: leaveTypeB.id,
      startsAt: "2026-07-15T00:00:00.000Z",
      endsAt: "2026-07-15T23:59:59.000Z",
      reason: "Other tenant"
    });

    const members = await teamService.findMembers(companyA.id, managerA.id);
    assert.deepEqual(
      members.map((member) => member.id),
      [employeeA.id]
    );

    const teamLeaves = await teamService.teamLeaveRequests(companyA.id, managerA.id, {});
    assert.deepEqual(
      teamLeaves.map((leave) => leave.id),
      [directLeave.id]
    );

    const pending = await teamService.pendingApprovals(companyA.id, managerA.id, {});
    assert.equal(pending.length, 1);
    assert.equal(pending[0].id, directLeave.id);

    await assert.rejects(() => teamService.approveTeamLeave(companyA.id, managerA.id, peerLeave.id, { comment: "Not my employee" }), (error) => {
      return typeof error === "object" && error !== null && "getStatus" in error && (error as { getStatus: () => number }).getStatus() === 403;
    });

    const approved = await teamService.approveTeamLeave(companyA.id, managerA.id, directLeave.id, { comment: "Approved by direct manager" });
    assert.equal(approved.status, LeaveStatus.APPROVED);

    await waitFor(async () => {
      const audit = await prisma.auditLog.findFirst({ where: { companyId: companyA.id, action: "TEAM_LEAVE_APPROVED", entityId: directLeave.id } });
      const search = await prisma.searchIndex.findFirst({
        where: { companyId: companyA.id, entityType: EntityType.LEAVE_REQUEST, entityId: directLeave.id, deletedAt: null }
      });
      return Boolean(audit && search?.content.includes("Manager A") && search.content.includes("Employee A") && search.content.includes("People"));
    });

    const availability = await teamService.availability(companyA.id, managerA.id, { referenceDate: "2026-07-15T12:00:00.000Z" });
    assert.equal(availability.today.onLeaveCount, 1);
    assert.equal(availability.today.onLeave[0].employeeId, employeeA.id);
    assert.equal(availability.today.availableCount, 0);

    const balances = await teamService.teamLeaveBalances(companyA.id, managerA.id, { year: 2026 });
    assert.equal(balances.length, 1);
    assert.equal(balances[0].employeeId, employeeA.id);
    assert.equal(Number(balances[0].usedDays), 1);
    assert.equal(Number(balances[0].remainingDays), 9);

    const directTask = await createTask(companyA.id, departmentA.id, managerA.id, employeeA.id, "TASK-TEAM-1", "Direct report task", new Date("2000-01-01T09:00:00.000Z"));
    await createTask(companyA.id, departmentA.id, otherManagerA.id, peerEmployeeA.id, "TASK-TEAM-2", "Peer task", new Date("2000-01-01T09:00:00.000Z"));
    await createTask(companyB.id, departmentB.id, managerB.id, employeeB.id, "TASK-TEAM-1", "Other tenant task", new Date("2000-01-01T09:00:00.000Z"));

    const teamTasks = await teamService.teamTasks(companyA.id, managerA.id, {});
    assert.deepEqual(
      teamTasks.map((task) => task.id),
      [directTask.id]
    );

    const overdueTasks = await teamService.overdueTeamTasks(companyA.id, managerA.id, {});
    assert.equal(overdueTasks.length, 1);
    assert.equal(overdueTasks[0].id, directTask.id);

    const dashboard = await teamService.dashboard(companyA.id, managerA.id);
    assert.equal(dashboard.counts.awayToday, 0);
    assert.equal(dashboard.counts.openTeamTasks, 1);
    assert.equal(dashboard.counts.overdueTeamTasks, 1);
    assert.equal(dashboard.teamLeaveBalances.length, 1);

    console.log("Team management assertions passed for hierarchy, direct-report filtering, approvals, balances, availability, tasks, dashboard, tenant isolation, and search.");
  } finally {
    leaveEventsHandler.onModuleDestroy();
    teamEventsHandler.onModuleDestroy();
    await cleanup(companyA.id);
    await cleanup(companyB.id);
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

async function createTask(companyId: string, departmentId: string, createdById: string, assigneeId: string, taskNumber: string, title: string, dueAt: Date) {
  const task = await prisma.task.create({
    data: {
      companyId,
      departmentId,
      createdById,
      taskNumber,
      title,
      description: title,
      status: TaskStatus.ASSIGNED,
      priority: TaskPriority.HIGH,
      dueAt
    }
  });

  await prisma.taskAssignee.create({
    data: {
      companyId,
      taskId: task.id,
      userId: assigneeId
    }
  });

  return task;
}

async function waitFor(predicate: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for team event side effect");
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
  await prisma.taskWatcher.deleteMany({ where: { companyId } });
  await prisma.taskAssignee.deleteMany({ where: { companyId } });
  await prisma.task.deleteMany({ where: { companyId } });
  await prisma.leaveRequest.deleteMany({ where: { companyId } });
  await prisma.leaveBalance.deleteMany({ where: { companyId } });
  await prisma.leaveSetting.deleteMany({ where: { companyId } });
  await prisma.leaveType.deleteMany({ where: { companyId } });
  await prisma.userRole.deleteMany({ where: { companyId } });
  await prisma.rolePermission.deleteMany({ where: { companyId } });
  await prisma.permission.deleteMany({ where: { companyId } });
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
