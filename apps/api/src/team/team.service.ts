import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EntityType, LeaveStatus, Prisma, TaskStatus } from "@prisma/client";
import { ApprovalDecisionDto } from "../leave-requests/dto/approval-action.dto";
import { LeaveRequestsService } from "../leave-requests/leave-requests.service";
import { DomainEventBus } from "../domain-events/domain-event-bus.service";
import { PrismaService } from "../prisma/prisma.service";
import { TeamAvailabilityQueryDto } from "./dto/team-availability-query.dto";
import { TeamBalanceQueryDto } from "./dto/team-balance-query.dto";
import { TeamLeaveQueryDto } from "./dto/team-leave-query.dto";
import { TeamTaskQueryDto } from "./dto/team-task-query.dto";

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leaveRequestsService: LeaveRequestsService,
    private readonly eventBus: DomainEventBus
  ) {}

  findMembers(companyId: string, managerId: string) {
    return this.prisma.user.findMany({
      where: this.directReportWhere(companyId, managerId),
      orderBy: { name: "asc" },
      select: this.memberSelect()
    });
  }

  async findMember(companyId: string, managerId: string, memberId: string) {
    const member = await this.prisma.user.findFirst({
      where: this.directReportWhere(companyId, managerId, { id: memberId }),
      select: this.memberSelect()
    });

    if (!member) {
      throw new NotFoundException("Team member not found");
    }

    const [leaveBalances, leaveRequests, tasks] = await Promise.all([
      this.teamLeaveBalances(companyId, managerId, { employeeId: memberId, year: new Date().getFullYear() }),
      this.teamLeaveRequests(companyId, managerId, { employeeId: memberId }),
      this.teamTasks(companyId, managerId, { employeeId: memberId })
    ]);

    return { ...member, leaveBalances, leaveRequests, tasks };
  }

  teamLeaveRequests(companyId: string, managerId: string, query: TeamLeaveQueryDto) {
    return this.prisma.leaveRequest.findMany({
      where: this.teamLeaveWhere(companyId, managerId, query),
      orderBy: [{ submittedAt: "desc" }],
      include: this.leaveInclude()
    });
  }

  pendingApprovals(companyId: string, managerId: string, query: TeamLeaveQueryDto) {
    return this.teamLeaveRequests(companyId, managerId, { ...query, status: LeaveStatus.PENDING });
  }

  async approveTeamLeave(companyId: string, managerId: string, leaveRequestId: string, dto: ApprovalDecisionDto) {
    const leave = await this.ensureDirectReportLeave(companyId, managerId, leaveRequestId);
    const approved = await this.leaveRequestsService.approve(companyId, managerId, leaveRequestId, dto);

    this.publishTeamEvent("TEAM_LEAVE_APPROVED", companyId, managerId, leaveRequestId, EntityType.LEAVE_REQUEST, {
      leaveRequestId,
      requestNumber: leave.requestNumber,
      managerId,
      employeeId: leave.employeeId,
      approvalStatus: approved.status,
      leaveType: leave.leaveType
    });

    return approved;
  }

  async rejectTeamLeave(companyId: string, managerId: string, leaveRequestId: string, dto: ApprovalDecisionDto) {
    const leave = await this.ensureDirectReportLeave(companyId, managerId, leaveRequestId);
    const rejected = await this.leaveRequestsService.reject(companyId, managerId, leaveRequestId, dto);

    this.publishTeamEvent("TEAM_LEAVE_REJECTED", companyId, managerId, leaveRequestId, EntityType.LEAVE_REQUEST, {
      leaveRequestId,
      requestNumber: leave.requestNumber,
      managerId,
      employeeId: leave.employeeId,
      approvalStatus: rejected.status,
      leaveType: leave.leaveType
    });

    return rejected;
  }

  async availability(companyId: string, managerId: string, query: TeamAvailabilityQueryDto) {
    const referenceDate = query.referenceDate ? new Date(query.referenceDate) : new Date();
    const [today, thisWeek, thisMonth] = await Promise.all([
      this.availabilityWindow(companyId, managerId, "today", this.startOfDay(referenceDate), this.endOfDay(referenceDate), query),
      this.availabilityWindow(companyId, managerId, "thisWeek", this.startOfWeek(referenceDate), this.endOfWeek(referenceDate), query),
      this.availabilityWindow(companyId, managerId, "thisMonth", this.startOfMonth(referenceDate), this.endOfMonth(referenceDate), query)
    ]);

    return { today, thisWeek, thisMonth };
  }

  teamLeaveBalances(companyId: string, managerId: string, query: TeamBalanceQueryDto) {
    return this.prisma.leaveBalance.findMany({
      where: {
        companyId,
        deletedAt: null,
        year: query.year ?? new Date().getFullYear(),
        employeeId: query.employeeId,
        leaveTypeId: query.leaveTypeId,
        employee: {
          managerId,
          deletedAt: null,
          departmentId: query.departmentId
        }
      },
      orderBy: [{ employee: { name: "asc" } }, { leaveType: { name: "asc" } }],
      include: this.balanceInclude()
    });
  }

  teamTasks(companyId: string, managerId: string, query: TeamTaskQueryDto) {
    return this.prisma.task.findMany({
      where: this.teamTaskWhere(companyId, managerId, query),
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      include: this.taskInclude()
    });
  }

  overdueTeamTasks(companyId: string, managerId: string, query: TeamTaskQueryDto) {
    return this.prisma.task.findMany({
      where: {
        ...this.teamTaskWhere(companyId, managerId, query),
        dueAt: { lt: new Date() },
        status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] }
      },
      orderBy: [{ dueAt: "asc" }],
      include: this.taskInclude()
    });
  }

  async dashboard(companyId: string, managerId: string) {
    const now = new Date();
    const todayStart = this.startOfDay(now);
    const todayEnd = this.endOfDay(now);
    const upcomingEnd = new Date(todayEnd);
    upcomingEnd.setUTCDate(upcomingEnd.getUTCDate() + 30);

    const [pendingApprovals, awayToday, upcomingAbsences, openTeamTasks, overdueTeamTasks, teamLeaveBalances] = await Promise.all([
      this.pendingApprovals(companyId, managerId, {}),
      this.findApprovedLeavesForWindow(companyId, managerId, todayStart, todayEnd, {}),
      this.findApprovedLeavesForWindow(companyId, managerId, todayEnd, upcomingEnd, {}),
      this.teamTasks(companyId, managerId, { status: undefined }),
      this.overdueTeamTasks(companyId, managerId, {}),
      this.teamLeaveBalances(companyId, managerId, { year: now.getFullYear() })
    ]);

    const openTasks = openTeamTasks.filter((task) => task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.CANCELLED);

    return {
      pendingApprovals,
      awayToday,
      upcomingAbsences,
      teamLeaveBalances,
      openTeamTasks: openTasks,
      overdueTeamTasks,
      counts: {
        pendingApprovals: pendingApprovals.length,
        awayToday: awayToday.length,
        upcomingAbsences: upcomingAbsences.length,
        openTeamTasks: openTasks.length,
        overdueTeamTasks: overdueTeamTasks.length,
        teamLeaveBalances: teamLeaveBalances.length
      }
    };
  }

  private async availabilityWindow(
    companyId: string,
    managerId: string,
    key: "today" | "thisWeek" | "thisMonth",
    from: Date,
    to: Date,
    query: TeamAvailabilityQueryDto
  ) {
    const [members, leaves] = await Promise.all([
      this.prisma.user.findMany({
        where: this.directReportWhere(companyId, managerId, {
          departmentId: query.departmentId,
          id: query.employeeId
        }),
        orderBy: { name: "asc" },
        select: this.memberSelect()
      }),
      this.findApprovedLeavesForWindow(companyId, managerId, from, to, query)
    ]);
    const onLeaveIds = new Set(leaves.map((leave) => leave.employeeId));

    return {
      key,
      from,
      to,
      totalMembers: members.length,
      onLeaveCount: onLeaveIds.size,
      availableCount: members.filter((member) => !onLeaveIds.has(member.id)).length,
      onLeave: leaves,
      available: members.filter((member) => !onLeaveIds.has(member.id))
    };
  }

  private findApprovedLeavesForWindow(
    companyId: string,
    managerId: string,
    from: Date,
    to: Date,
    query: Pick<TeamAvailabilityQueryDto, "departmentId" | "employeeId" | "leaveTypeId">
  ) {
    return this.prisma.leaveRequest.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: LeaveStatus.APPROVED,
        departmentId: query.departmentId,
        employeeId: query.employeeId,
        leaveTypeId: query.leaveTypeId,
        startsAt: { lte: to },
        endsAt: { gte: from },
        employee: {
          managerId,
          deletedAt: null
        }
      },
      orderBy: [{ startsAt: "asc" }, { employee: { name: "asc" } }],
      include: this.leaveInclude()
    });
  }

  private async ensureDirectReportLeave(companyId: string, managerId: string, leaveRequestId: string) {
    const leave = await this.prisma.leaveRequest.findFirst({
      where: {
        id: leaveRequestId,
        companyId,
        deletedAt: null,
        employee: {
          companyId,
          managerId,
          deletedAt: null
        }
      },
      include: {
        employee: { select: { id: true, name: true, email: true, managerId: true } },
        department: { select: { id: true, name: true, code: true } },
        leaveTypeRef: { select: { id: true, name: true, code: true } }
      }
    });

    if (!leave || leave.employeeId === managerId) {
      throw new ForbiddenException("Leave request is outside your team");
    }

    return leave;
  }

  private teamLeaveWhere(companyId: string, managerId: string, query: TeamLeaveQueryDto): Prisma.LeaveRequestWhereInput {
    return {
      companyId,
      deletedAt: null,
      status: query.status,
      requestType: query.requestType,
      employeeId: query.employeeId,
      departmentId: query.departmentId,
      leaveTypeId: query.leaveTypeId,
      employee: {
        managerId,
        deletedAt: null
      },
      startsAt:
        query.startsFrom || query.startsTo
          ? {
              gte: query.startsFrom ? new Date(query.startsFrom) : undefined,
              lte: query.startsTo ? new Date(query.startsTo) : undefined
            }
          : undefined,
      OR: query.search
        ? [
            { requestNumber: { contains: query.search, mode: "insensitive" } },
            { leaveType: { contains: query.search, mode: "insensitive" } },
            { reason: { contains: query.search, mode: "insensitive" } },
            { department: { name: { contains: query.search, mode: "insensitive" } } },
            { employee: { name: { contains: query.search, mode: "insensitive" } } }
          ]
        : undefined
    };
  }

  private teamTaskWhere(companyId: string, managerId: string, query: TeamTaskQueryDto): Prisma.TaskWhereInput {
    return {
      companyId,
      deletedAt: null,
      status: query.status,
      priority: query.priority,
      departmentId: query.departmentId,
      dueAt:
        query.dueFrom || query.dueTo
          ? {
              gte: query.dueFrom ? new Date(query.dueFrom) : undefined,
              lte: query.dueTo ? new Date(query.dueTo) : undefined
            }
          : undefined,
      assignees: {
        some: {
          deletedAt: null,
          userId: query.employeeId,
          user: {
            companyId,
            managerId,
            deletedAt: null
          }
        }
      },
      OR: query.search
        ? [
            { taskNumber: { contains: query.search, mode: "insensitive" } },
            { title: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
            { assignees: { some: { user: { name: { contains: query.search, mode: "insensitive" } } } } }
          ]
        : undefined
    };
  }

  private directReportWhere(companyId: string, managerId: string, extra?: Prisma.UserWhereInput): Prisma.UserWhereInput {
    return {
      companyId,
      managerId,
      deletedAt: null,
      ...extra
    };
  }

  private publishTeamEvent(
    name: "TEAM_LEAVE_APPROVED" | "TEAM_LEAVE_REJECTED" | "TEAM_MEMBER_ASSIGNED",
    companyId: string,
    actorId: string | null,
    entityId: string,
    entityType: EntityType,
    payload: Record<string, unknown>
  ) {
    this.eventBus.publish({
      name,
      companyId,
      actorId,
      entityType,
      entityId,
      payload
    });
  }

  private memberSelect() {
    return {
      id: true,
      companyId: true,
      departmentId: true,
      managerId: true,
      email: true,
      name: true,
      jobTitle: true,
      locale: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      department: { select: { id: true, name: true, code: true } },
      manager: { select: { id: true, name: true, email: true } },
      _count: {
        select: {
          directReports: true,
          assignedTasks: true,
          leaveRequests: true,
          leaveBalances: true
        }
      }
    } as const;
  }

  private leaveInclude() {
    return {
      employee: { select: { id: true, name: true, email: true, jobTitle: true, managerId: true } },
      department: { select: { id: true, name: true, code: true } },
      leaveTypeRef: { select: { id: true, name: true, code: true } }
    } as const;
  }

  private balanceInclude() {
    return {
      employee: { select: { id: true, name: true, email: true, jobTitle: true, managerId: true, department: { select: { id: true, name: true, code: true } } } },
      leaveType: { select: { id: true, name: true, code: true } }
    } as const;
  }

  private taskInclude() {
    return {
      department: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      assignees: {
        where: { deletedAt: null },
        include: {
          user: { select: { id: true, name: true, email: true, jobTitle: true, managerId: true } }
        }
      }
    } as const;
  }

  private startOfDay(date: Date) {
    const copy = new Date(date);
    copy.setUTCHours(0, 0, 0, 0);
    return copy;
  }

  private endOfDay(date: Date) {
    const copy = new Date(date);
    copy.setUTCHours(23, 59, 59, 999);
    return copy;
  }

  private startOfWeek(date: Date) {
    const copy = this.startOfDay(date);
    const day = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() - day + 1);
    return copy;
  }

  private endOfWeek(date: Date) {
    const copy = this.startOfWeek(date);
    copy.setUTCDate(copy.getUTCDate() + 6);
    copy.setUTCHours(23, 59, 59, 999);
    return copy;
  }

  private startOfMonth(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  }

  private endOfMonth(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  }
}
