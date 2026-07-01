import { EntityType, LeaveDurationType, LeaveRequestType, LeaveStatus, SystemRole, TaskPriority, TaskStatus, UserStatus } from "@prisma/client";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PERMISSIONS } from "../../common/constants";
import { PrismaService } from "../../prisma/prisma.service";
import { SavedFiltersService } from "../saved-filters.service";
import { SearchService } from "../search.service";

const prisma = new PrismaService();

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const searchService = new SearchService(prisma);
  const savedFiltersService = new SavedFiltersService(prisma);
  const [companyA, companyB] = await Promise.all([
    prisma.company.create({ data: { name: `Search A ${suffix}`, slug: `search-a-${suffix}` } }),
    prisma.company.create({ data: { name: `Search B ${suffix}`, slug: `search-b-${suffix}` } })
  ]);

  try {
    const [managerA, otherManagerA, employeeA, peerEmployeeA, employeeB] = await Promise.all([
      createUser(companyA.id, `manager-a-${suffix}@example.com`, "Manager Ahmed"),
      createUser(companyA.id, `other-manager-a-${suffix}@example.com`, "Other Manager"),
      createUser(companyA.id, `employee-a-${suffix}@example.com`, "Ahmed Hassan"),
      createUser(companyA.id, `peer-a-${suffix}@example.com`, "Peer Employee"),
      createUser(companyB.id, `employee-b-${suffix}@example.com`, "Ahmed Other Tenant")
    ]);
    const [departmentA, departmentB] = await Promise.all([
      prisma.department.create({ data: { companyId: companyA.id, name: "Operations", code: `OPS-${suffix}`, managerId: managerA.id } }),
      prisma.department.create({ data: { companyId: companyB.id, name: "Operations", code: `OPS-B-${suffix}` } })
    ]);

    await Promise.all([
      prisma.user.update({ where: { id: managerA.id }, data: { departmentId: departmentA.id } }),
      prisma.user.update({ where: { id: employeeA.id }, data: { departmentId: departmentA.id, managerId: managerA.id } }),
      prisma.user.update({ where: { id: peerEmployeeA.id }, data: { departmentId: departmentA.id, managerId: otherManagerA.id } }),
      prisma.user.update({ where: { id: employeeB.id }, data: { departmentId: departmentB.id } })
    ]);

    const [taskA, peerTaskA, taskB] = await Promise.all([
      createTask(companyA.id, departmentA.id, managerA.id, employeeA.id, "TASK-1001", "TASK-1001 Payroll Review"),
      createTask(companyA.id, departmentA.id, otherManagerA.id, peerEmployeeA.id, "TASK-2001", "TASK-2001 Peer Payroll"),
      createTask(companyB.id, departmentB.id, employeeB.id, employeeB.id, "TASK-1001", "TASK-1001 Other Tenant")
    ]);
    const [leaveTypeA, leaveTypeB] = await Promise.all([
      prisma.leaveType.create({ data: { companyId: companyA.id, name: "Annual Leave", code: "ANNUAL", annualAllowanceDays: 21 } }),
      prisma.leaveType.create({ data: { companyId: companyB.id, name: "Annual Leave", code: "ANNUAL", annualAllowanceDays: 21 } })
    ]);
    const [leaveA, peerLeaveA, leaveB] = await Promise.all([
      createLeave(companyA.id, employeeA.id, departmentA.id, leaveTypeA.id, "LR-1001", "Annual Leave", "Ahmed annual vacation"),
      createLeave(companyA.id, peerEmployeeA.id, departmentA.id, leaveTypeA.id, "LR-2001", "Annual Leave", "Peer annual vacation"),
      createLeave(companyB.id, employeeB.id, departmentB.id, leaveTypeB.id, "LR-1001", "Annual Leave", "Other tenant annual vacation")
    ]);

    await Promise.all([
      index(companyA.id, EntityType.USER, employeeA.id, "Ahmed Hassan", "Ahmed Hassan\nemployee-a@example.com\nSales Specialist\nOperations\nManager Ahmed"),
      index(companyA.id, EntityType.USER, peerEmployeeA.id, "Peer Employee", "Peer Employee\nOperations\nOther Manager"),
      index(companyB.id, EntityType.USER, employeeB.id, "Ahmed Other Tenant", "Ahmed Other Tenant\nOperations"),
      index(companyA.id, EntityType.DEPARTMENT, departmentA.id, "Operations", `Operations\nOPS-${suffix}\nManager Ahmed`),
      index(companyB.id, EntityType.DEPARTMENT, departmentB.id, "Operations", `Operations\nOPS-B-${suffix}`),
      index(companyA.id, EntityType.TASK, taskA.id, "TASK-1001 Payroll Review", "TASK-1001\nPayroll Review\nAhmed Hassan\nOperations\nhandover.pdf"),
      index(companyA.id, EntityType.TASK, peerTaskA.id, "TASK-2001 Peer Payroll", "TASK-2001\nPeer Payroll\nPeer Employee\nOperations"),
      index(companyB.id, EntityType.TASK, taskB.id, "TASK-1001 Other Tenant", "TASK-1001\nOther Tenant\nAhmed Other Tenant"),
      index(companyA.id, EntityType.LEAVE_REQUEST, leaveA.id, "LR-1001 Ahmed Hassan Annual Leave", "LR-1001\nAhmed Hassan\nManager Ahmed\nAnnual Leave\nOperations\nAPPROVED"),
      index(companyA.id, EntityType.LEAVE_REQUEST, peerLeaveA.id, "LR-2001 Peer Employee Annual Leave", "LR-2001\nPeer Employee\nOther Manager\nAnnual Leave\nOperations\nAPPROVED"),
      index(companyB.id, EntityType.LEAVE_REQUEST, leaveB.id, "LR-1001 Ahmed Other Tenant Annual Leave", "LR-1001\nAhmed Other Tenant\nAnnual Leave")
    ]);

    const managerUser = {
      id: managerA.id,
      companyId: companyA.id,
      email: managerA.email,
      roles: [SystemRole.MANAGER],
      permissions: [
        PERMISSIONS.searchRead,
        PERMISSIONS.usersViewTeam,
        PERMISSIONS.tasksViewTeam,
        PERMISSIONS.leaveRequestsViewTeam,
        PERMISSIONS.departmentsRead,
        PERMISSIONS.savedFiltersRead,
        PERMISSIONS.savedFiltersWrite
      ]
    };

    const teamResults = await searchService.search(companyA.id, managerUser, { q: "Ahmed", type: "ALL", limit: 20 });
    assert.ok(teamResults.results.some((result) => result.id === employeeA.id && result.type === EntityType.USER));
    assert.ok(teamResults.results.some((result) => result.id === leaveA.id && result.type === EntityType.LEAVE_REQUEST));
    assert.ok(!teamResults.results.some((result) => result.id === peerEmployeeA.id || result.id === peerLeaveA.id || result.id === employeeB.id || result.id === leaveB.id));

    const ranked = await searchService.search(companyA.id, managerUser, { q: "TASK-1001", type: "TASK", limit: 5 });
    assert.equal(ranked.results[0].id, taskA.id);
    assert.equal(ranked.results[0].type, EntityType.TASK);
    assert.ok(!ranked.results.some((result) => result.id === peerTaskA.id || result.id === taskB.id));

    const noEntityPermissions = await searchService.search(
      companyA.id,
      { ...managerUser, permissions: [PERMISSIONS.searchRead] },
      { q: "Ahmed", type: "ALL", limit: 20 }
    );
    assert.equal(noEntityPermissions.results.length, 0);

    const saved = await savedFiltersService.create(companyA.id, managerA.id, {
      name: "My Open Tasks",
      entityType: EntityType.TASK,
      filterJson: { assignedToId: employeeA.id, status: TaskStatus.ASSIGNED }
    });
    assert.equal(saved.name, "My Open Tasks");

    const savedFilters = await savedFiltersService.findAll(companyA.id, managerA.id, { entityType: EntityType.TASK });
    assert.equal(savedFilters.length, 1);
    assert.equal(savedFilters[0].id, saved.id);

    const updated = await savedFiltersService.update(companyA.id, managerA.id, saved.id, {
      name: "Assigned To Ahmed",
      filterJson: { assignedToId: employeeA.id }
    });
    assert.equal(updated.name, "Assigned To Ahmed");

    await savedFiltersService.remove(companyA.id, managerA.id, saved.id);
    const afterDelete = await savedFiltersService.findAll(companyA.id, managerA.id, {});
    assert.equal(afterDelete.length, 0);

    for (let i = 0; i < 22; i += 1) {
      await searchService.search(companyA.id, managerUser, { q: `Ahmed ${i}`, type: "ALL" });
    }
    const recent = await searchService.recent(companyA.id, managerA.id);
    assert.equal(recent.length, 20);
    assert.equal(recent[0].query, "Ahmed 21");
    assert.ok(!recent.some((item) => item.query === "Ahmed 0"));

    console.log("Global search assertions passed for ranking, tenant isolation, permission filtering, saved filters, recent searches, and command-palette API usage.");
  } finally {
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

async function createTask(companyId: string, departmentId: string, createdById: string, assigneeId: string, taskNumber: string, title: string) {
  const task = await prisma.task.create({
    data: {
      companyId,
      departmentId,
      createdById,
      taskNumber,
      title,
      description: title,
      status: TaskStatus.ASSIGNED,
      priority: TaskPriority.HIGH
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

function createLeave(companyId: string, employeeId: string, departmentId: string, leaveTypeId: string, requestNumber: string, leaveType: string, reason: string) {
  return prisma.leaveRequest.create({
    data: {
      companyId,
      employeeId,
      departmentId,
      leaveTypeId,
      requestNumber,
      requestType: LeaveRequestType.LEAVE,
      leaveType,
      startsAt: new Date("2026-07-15T00:00:00.000Z"),
      endsAt: new Date("2026-07-15T23:59:59.999Z"),
      durationType: LeaveDurationType.FULL_DAY,
      durationDays: 1,
      status: LeaveStatus.APPROVED,
      approvedAt: new Date("2026-07-01T09:00:00.000Z"),
      reason
    }
  });
}

function index(companyId: string, entityType: EntityType, entityId: string, title: string, content: string) {
  return prisma.searchIndex.create({
    data: {
      companyId,
      entityType,
      entityId,
      title,
      content
    }
  });
}

async function cleanup(companyId: string) {
  await prisma.recentSearch.deleteMany({ where: { companyId } });
  await prisma.savedFilter.deleteMany({ where: { companyId } });
  await prisma.searchIndex.deleteMany({ where: { companyId } });
  await prisma.notification.deleteMany({ where: { companyId } });
  await prisma.auditLog.deleteMany({ where: { companyId } });
  await prisma.activity.deleteMany({ where: { companyId } });
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
