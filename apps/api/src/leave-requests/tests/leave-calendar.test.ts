import { LeaveDurationType, LeaveRequestType, LeaveStatus, UserStatus } from "@prisma/client";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ApprovalWorkflowsService } from "../../approval-workflows/approval-workflows.service";
import { AttachmentsService } from "../../attachments/attachments.service";
import { CommentsService } from "../../comments/comments.service";
import { DomainEventBus } from "../../domain-events/domain-event-bus.service";
import { PrismaService } from "../../prisma/prisma.service";
import { StorageProvider } from "../../storage/storage-provider";
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
  const leaveRequestsService = new LeaveRequestsService(
    prisma,
    eventBus,
    new ApprovalWorkflowsService(prisma),
    new CommentsService(prisma),
    new AttachmentsService(prisma, storage),
    new LeaveBalancesService(prisma, eventBus)
  );

  const [companyA, companyB] = await Promise.all([
    prisma.company.create({ data: { name: `Calendar A ${suffix}`, slug: `calendar-a-${suffix}` } }),
    prisma.company.create({ data: { name: `Calendar B ${suffix}`, slug: `calendar-b-${suffix}` } })
  ]);

  try {
    const [employeeA, employeeB] = await Promise.all([
      prisma.user.create({
        data: {
          companyId: companyA.id,
          email: `employee-a-${suffix}@example.com`,
          passwordHash: "test",
          name: "Calendar Employee A",
          status: UserStatus.ACTIVE
        }
      }),
      prisma.user.create({
        data: {
          companyId: companyB.id,
          email: `employee-b-${suffix}@example.com`,
          passwordHash: "test",
          name: "Calendar Employee B",
          status: UserStatus.ACTIVE
        }
      })
    ]);
    const [departmentA, departmentB] = await Promise.all([
      prisma.department.create({ data: { companyId: companyA.id, name: "HR", code: `HR-A-${suffix}` } }),
      prisma.department.create({ data: { companyId: companyB.id, name: "HR", code: `HR-B-${suffix}` } })
    ]);
    const [leaveTypeA, leaveTypeB] = await Promise.all([
      prisma.leaveType.create({ data: { companyId: companyA.id, name: "Annual Leave", code: "ANNUAL" } }),
      prisma.leaveType.create({ data: { companyId: companyB.id, name: "Annual Leave", code: "ANNUAL" } })
    ]);

    await Promise.all([
      prisma.user.update({ where: { id: employeeA.id }, data: { departmentId: departmentA.id } }),
      prisma.user.update({ where: { id: employeeB.id }, data: { departmentId: departmentB.id } })
    ]);
    const leaveA = await prisma.leaveRequest.create({
      data: {
        companyId: companyA.id,
        employeeId: employeeA.id,
        departmentId: departmentA.id,
        leaveTypeId: leaveTypeA.id,
        requestNumber: "LR-00001",
        requestType: LeaveRequestType.LEAVE,
        leaveType: leaveTypeA.name,
        startsAt: new Date("2026-07-10T00:00:00.000Z"),
        endsAt: new Date("2026-07-12T23:59:59.000Z"),
        durationType: LeaveDurationType.FULL_DAY,
        durationDays: 3,
        status: LeaveStatus.APPROVED,
        approvedAt: new Date("2026-07-01T09:00:00.000Z")
      }
    });
    await prisma.leaveRequest.create({
      data: {
        companyId: companyB.id,
        employeeId: employeeB.id,
        departmentId: departmentB.id,
        leaveTypeId: leaveTypeB.id,
        requestNumber: "LR-00001",
        requestType: LeaveRequestType.LEAVE,
        leaveType: leaveTypeB.name,
        startsAt: new Date("2026-07-10T00:00:00.000Z"),
        endsAt: new Date("2026-07-12T23:59:59.000Z"),
        durationType: LeaveDurationType.FULL_DAY,
        durationDays: 3,
        status: LeaveStatus.APPROVED,
        approvedAt: new Date("2026-07-01T09:00:00.000Z")
      }
    });

    const team = await leaveRequestsService.calendar(companyA.id, {
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-31T23:59:59.999Z"
    });
    assert.equal(team.length, 1);
    assert.equal(team[0].id, leaveA.id);

    const department = await leaveRequestsService.calendar(companyA.id, {
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-31T23:59:59.999Z",
      departmentId: departmentA.id,
      employeeId: employeeA.id,
      leaveTypeId: leaveTypeA.id,
      groupBy: "month"
    });
    assert.equal(department.length, 1);
    assert.equal(department[0].departmentId, departmentA.id);

    const otherDepartment = await leaveRequestsService.calendar(companyA.id, {
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-31T23:59:59.999Z",
      departmentId: departmentB.id
    });
    assert.equal(otherDepartment.length, 0);

    console.log("Leave calendar assertions passed for team, department, filters, and tenant isolation.");
  } finally {
    await cleanup(companyA.id);
    await cleanup(companyB.id);
    await prisma.$disconnect();
  }
}

async function cleanup(companyId: string) {
  await prisma.leaveRequest.deleteMany({ where: { companyId } });
  await prisma.leaveType.deleteMany({ where: { companyId } });
  await prisma.department.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
}

void main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
