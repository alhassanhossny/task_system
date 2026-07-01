import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EntityType, LeaveApprovalMode, LeaveDurationType, LeaveHalfDayPeriod, LeaveStatus, Prisma } from "@prisma/client";
import { ApprovalWorkflowsService } from "../approval-workflows/approval-workflows.service";
import { AttachmentsService } from "../attachments/attachments.service";
import { CommentsService } from "../comments/comments.service";
import { DomainEventBus } from "../domain-events/domain-event-bus.service";
import { PrismaService } from "../prisma/prisma.service";
import { ApprovalDecisionDto } from "./dto/approval-action.dto";
import { CreateLeaveAttachmentDto } from "./dto/create-leave-attachment.dto";
import { CreateLeaveCommentDto } from "./dto/create-leave-comment.dto";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { CreateLeaveTypeDto } from "./dto/create-leave-type.dto";
import { LeaveBalanceQueryDto } from "./dto/leave-balance-query.dto";
import { LeaveCalendarQueryDto } from "./dto/leave-calendar-query.dto";
import { LeaveQueryDto } from "./dto/leave-query.dto";
import { UpdateLeaveSettingsDto } from "./dto/update-leave-settings.dto";
import { UpdateLeaveRequestDto } from "./dto/update-leave-request.dto";
import { UpdateLeaveTypeDto } from "./dto/update-leave-type.dto";
import { UpsertLeaveBalanceDto } from "./dto/upsert-leave-balance.dto";

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
    private readonly approvalWorkflows: ApprovalWorkflowsService,
    private readonly commentsService: CommentsService,
    private readonly attachmentsService: AttachmentsService
  ) {}

  findSettings(companyId: string) {
    return this.prisma.leaveSetting.upsert({
      where: { companyId },
      update: { deletedAt: null },
      create: { companyId, approvalMode: LeaveApprovalMode.MANAGER_HR }
    });
  }

  async updateSettings(companyId: string, dto: UpdateLeaveSettingsDto) {
    return this.approvalWorkflows.configureLeaveWorkflow(companyId, dto.approvalMode);
  }

  findBalances(companyId: string, query: LeaveBalanceQueryDto) {
    return this.prisma.leaveBalance.findMany({
      where: {
        companyId,
        deletedAt: null,
        employeeId: query.employeeId,
        year: query.year ?? new Date().getFullYear()
      },
      orderBy: [{ employee: { name: "asc" } }, { leaveType: { name: "asc" } }],
      include: {
        employee: { select: { id: true, name: true, email: true, jobTitle: true } },
        leaveType: { select: { id: true, name: true, code: true, isPaid: true } }
      }
    });
  }

  async upsertBalance(companyId: string, dto: UpsertLeaveBalanceDto) {
    await Promise.all([this.ensureUser(companyId, dto.employeeId), this.ensureLeaveType(companyId, dto.leaveTypeId)]);

    const usedDays = dto.usedDays ?? 0;
    if (usedDays > dto.allocatedDays) {
      throw new BadRequestException("Used leave days cannot exceed allocated days");
    }

    return this.prisma.leaveBalance.upsert({
      where: {
        companyId_employeeId_leaveTypeId_year: {
          companyId,
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          year: dto.year
        }
      },
      update: {
        allocatedDays: dto.allocatedDays,
        usedDays,
        remainingDays: dto.allocatedDays - usedDays,
        deletedAt: null
      },
      create: {
        companyId,
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        year: dto.year,
        allocatedDays: dto.allocatedDays,
        usedDays,
        remainingDays: dto.allocatedDays - usedDays
      },
      include: {
        employee: { select: { id: true, name: true, email: true, jobTitle: true } },
        leaveType: { select: { id: true, name: true, code: true, isPaid: true } }
      }
    });
  }

  findTypes(companyId: string) {
    return this.prisma.leaveType.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    });
  }

  createType(companyId: string, dto: CreateLeaveTypeDto) {
    return this.prisma.leaveType.create({
      data: {
        companyId,
        name: dto.name,
        code: dto.code.toUpperCase(),
        description: dto.description,
        isPaid: dto.isPaid ?? true,
        annualAllowanceDays: dto.annualAllowanceDays
      }
    });
  }

  async updateType(companyId: string, id: string, dto: UpdateLeaveTypeDto) {
    await this.ensureLeaveType(companyId, id);

    return this.prisma.leaveType.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code?.toUpperCase(),
        description: dto.description,
        isPaid: dto.isPaid,
        annualAllowanceDays: dto.annualAllowanceDays
      }
    });
  }

  findAll(companyId: string, query: LeaveQueryDto) {
    return this.prisma.leaveRequest.findMany({
      where: this.buildWhere(companyId, query),
      orderBy: [{ submittedAt: "desc" }],
      include: this.leaveInclude()
    });
  }

  async findOne(companyId: string, id: string) {
    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.leaveDetailInclude()
    });

    if (!leave) {
      throw new NotFoundException("Leave request not found");
    }

    const [activities, approvalActions] = await Promise.all([
      this.findActivities(companyId, id),
      this.approvalWorkflows.getActions(companyId, EntityType.LEAVE_REQUEST, id)
    ]);

    return { ...leave, activities, approvalActions };
  }

  async create(companyId: string, actorId: string, dto: CreateLeaveRequestDto) {
    const employeeId = dto.employeeId ?? actorId;
    const [employee, leaveType] = await Promise.all([this.ensureUser(companyId, employeeId), this.ensureLeaveType(companyId, dto.leaveTypeId)]);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (endsAt < startsAt) {
      throw new BadRequestException("Leave end date must be after start date");
    }

    const duration = this.resolveDuration(dto, startsAt, endsAt);
    await this.ensureBalanceAvailable(companyId, employeeId, leaveType, startsAt.getFullYear(), duration.durationDays);

    const leave = await this.prisma.leaveRequest.create({
      data: {
        companyId,
        employeeId,
        departmentId: employee.departmentId,
        leaveTypeId: leaveType.id,
        leaveType: leaveType.name,
        startsAt,
        endsAt,
        durationType: duration.durationType,
        durationDays: duration.durationDays,
        durationHours: duration.durationHours,
        halfDayPeriod: duration.halfDayPeriod,
        reason: dto.reason,
        status: LeaveStatus.PENDING,
        submittedAt: new Date()
      },
      include: this.leaveDetailInclude()
    });

    await this.approvalWorkflows.startWorkflow(companyId, EntityType.LEAVE_REQUEST, leave.id);

    this.publishLeaveEvent("LEAVE_SUBMITTED", companyId, actorId, leave.id, {
      leaveRequestId: leave.id,
      employeeId,
      leaveType: leaveType.name,
      startsAt: leave.startsAt,
      endsAt: leave.endsAt,
      durationDays: duration.durationDays
    });

    return this.findOne(companyId, leave.id);
  }

  async update(companyId: string, actorId: string, id: string, dto: UpdateLeaveRequestDto) {
    const existing = await this.ensureLeave(companyId, id);

    if (existing.status !== LeaveStatus.PENDING && existing.status !== LeaveStatus.INFO_REQUESTED) {
      throw new BadRequestException("Only pending leave requests can be updated");
    }

    const leaveType = dto.leaveTypeId ? await this.ensureLeaveType(companyId, dto.leaveTypeId) : null;
    const targetLeaveType = leaveType ?? (existing.leaveTypeId ? await this.ensureLeaveType(companyId, existing.leaveTypeId) : null);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;

    if (endsAt < startsAt) {
      throw new BadRequestException("Leave end date must be after start date");
    }

    const duration = this.resolveDuration(
      {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        durationType: dto.durationType ?? existing.durationType,
        durationHours: dto.durationHours === undefined ? (existing.durationHours ? Number(existing.durationHours) : undefined) : dto.durationHours ?? undefined,
        halfDayPeriod: dto.halfDayPeriod === undefined ? existing.halfDayPeriod ?? undefined : dto.halfDayPeriod ?? undefined
      },
      startsAt,
      endsAt
    );

    if (targetLeaveType) {
      await this.ensureBalanceAvailable(companyId, existing.employeeId, targetLeaveType, startsAt.getFullYear(), duration.durationDays);
    }

    const leave = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        leaveTypeId: leaveType?.id,
        leaveType: leaveType?.name,
        startsAt: dto.startsAt ? startsAt : undefined,
        endsAt: dto.endsAt ? endsAt : undefined,
        durationType: duration.durationType,
        durationDays: duration.durationDays,
        durationHours: duration.durationHours,
        halfDayPeriod: duration.halfDayPeriod,
        status: existing.status === LeaveStatus.INFO_REQUESTED ? LeaveStatus.PENDING : undefined,
        infoRequestedAt: existing.status === LeaveStatus.INFO_REQUESTED ? null : undefined,
        reason: dto.reason
      },
      include: this.leaveDetailInclude()
    });

    this.publishLeaveEvent("LEAVE_UPDATED", companyId, actorId, id, {
      leaveRequestId: id,
      leaveType: leave.leaveType,
      durationDays: duration.durationDays
    });

    return leave;
  }

  async approve(companyId: string, actorId: string, id: string, dto: ApprovalDecisionDto) {
    const existing = await this.ensureLeave(companyId, id);

    if (existing.status !== LeaveStatus.PENDING) {
      throw new BadRequestException("Only pending leave requests can be approved");
    }

    const result = await this.approvalWorkflows.approveNext(companyId, EntityType.LEAVE_REQUEST, id, actorId, dto.comment);
    const leave = result.complete
      ? await this.prisma.$transaction(async (tx) => {
          const approved = await tx.leaveRequest.update({
            where: { id },
            data: { status: LeaveStatus.APPROVED, approvedAt: new Date() },
            include: this.leaveDetailInclude()
          });
          await this.consumeApprovedLeaveBalance(tx, companyId, approved);
          return approved;
        })
      : await this.findOne(companyId, id);

    this.publishLeaveEvent(result.complete ? "LEAVE_APPROVED" : "LEAVE_APPROVAL_STEP_APPROVED", companyId, actorId, id, {
      leaveRequestId: id,
      approvalActionId: result.action.id,
      complete: result.complete
    });

    return leave;
  }

  async reject(companyId: string, actorId: string, id: string, dto: ApprovalDecisionDto) {
    const existing = await this.ensureLeave(companyId, id);

    if (existing.status !== LeaveStatus.PENDING) {
      throw new BadRequestException("Only pending leave requests can be rejected");
    }

    const result = await this.approvalWorkflows.rejectNext(companyId, EntityType.LEAVE_REQUEST, id, actorId, dto.comment);
    const leave = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveStatus.REJECTED, rejectedAt: new Date() },
      include: this.leaveDetailInclude()
    });

    this.publishLeaveEvent("LEAVE_REJECTED", companyId, actorId, id, {
      leaveRequestId: id,
      approvalActionId: result.action.id
    });

    return leave;
  }

  async requestMoreInformation(companyId: string, actorId: string, id: string, dto: ApprovalDecisionDto) {
    const existing = await this.ensureLeave(companyId, id);

    if (existing.status !== LeaveStatus.PENDING) {
      throw new BadRequestException("Only pending leave requests can require more information");
    }

    const action = await this.approvalWorkflows.ensureCanActOnNext(companyId, EntityType.LEAVE_REQUEST, id, actorId);
    const leave = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveStatus.INFO_REQUESTED, infoRequestedAt: new Date() },
      include: this.leaveDetailInclude()
    });

    this.publishLeaveEvent("LEAVE_INFO_REQUESTED", companyId, actorId, id, {
      leaveRequestId: id,
      approvalActionId: action.id,
      comment: dto.comment
    });

    return leave;
  }

  async cancel(companyId: string, actorId: string, id: string, dto: ApprovalDecisionDto) {
    const existing = await this.ensureLeave(companyId, id);

    if (existing.status !== LeaveStatus.PENDING) {
      throw new BadRequestException("Only pending leave requests can be cancelled");
    }

    const leave = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveStatus.CANCELLED, cancelledAt: new Date() },
      include: this.leaveDetailInclude()
    });

    await this.prisma.approvalAction.updateMany({
      where: { companyId, entityType: EntityType.LEAVE_REQUEST, entityId: id, deletedAt: null },
      data: { status: "CANCELLED" }
    });

    this.publishLeaveEvent("LEAVE_CANCELLED", companyId, actorId, id, {
      leaveRequestId: id,
      comment: dto.comment
    });

    return leave;
  }

  async findComments(companyId: string, id: string) {
    await this.ensureLeave(companyId, id);
    return this.commentsService.findByEntity(companyId, EntityType.LEAVE_REQUEST, id);
  }

  async addComment(companyId: string, actorId: string, id: string, dto: CreateLeaveCommentDto) {
    await this.ensureLeave(companyId, id);
    const comment = await this.commentsService.create(companyId, actorId, {
      entityType: EntityType.LEAVE_REQUEST,
      entityId: id,
      content: dto.content
    });

    this.publishLeaveEvent("LEAVE_COMMENTED", companyId, actorId, id, {
      leaveRequestId: id,
      commentId: comment.id
    });

    return comment;
  }

  async findAttachments(companyId: string, id: string) {
    await this.ensureLeave(companyId, id);
    return this.attachmentsService.findByEntity(companyId, EntityType.LEAVE_REQUEST, id);
  }

  async addAttachment(companyId: string, actorId: string, id: string, dto: CreateLeaveAttachmentDto) {
    await this.ensureLeave(companyId, id);
    const attachment = await this.attachmentsService.create(companyId, actorId, {
      entityType: EntityType.LEAVE_REQUEST,
      entityId: id,
      fileName: dto.fileName,
      filePath: dto.filePath,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize
    });

    this.publishLeaveEvent("LEAVE_ATTACHMENT_ADDED", companyId, actorId, id, {
      leaveRequestId: id,
      attachmentId: attachment.id
    });

    return attachment;
  }

  async history(companyId: string, id: string) {
    await this.ensureLeave(companyId, id);

    const [activities, comments, attachments, approvalActions] = await Promise.all([
      this.findActivities(companyId, id),
      this.commentsService.findByEntity(companyId, EntityType.LEAVE_REQUEST, id),
      this.attachmentsService.findByEntity(companyId, EntityType.LEAVE_REQUEST, id),
      this.approvalWorkflows.getActions(companyId, EntityType.LEAVE_REQUEST, id)
    ]);

    return { activities, comments, attachments, approvalActions };
  }

  calendar(companyId: string, query: LeaveCalendarQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);

    if (to < from) {
      throw new BadRequestException("Calendar end date must be after start date");
    }

    return this.prisma.leaveRequest.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: LeaveStatus.APPROVED,
        departmentId: query.departmentId,
        startsAt: { lte: to },
        endsAt: { gte: from }
      },
      orderBy: [{ startsAt: "asc" }, { employee: { name: "asc" } }],
      include: this.leaveInclude()
    });
  }

  async availability(companyId: string, query: LeaveCalendarQueryDto) {
    const dayStart = new Date(query.from);
    const dayEnd = new Date(query.to);

    if (dayEnd < dayStart) {
      throw new BadRequestException("Availability end date must be after start date");
    }

    const [employees, leaves] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: "ACTIVE",
          departmentId: query.departmentId
        },
        select: {
          id: true,
          name: true,
          email: true,
          jobTitle: true,
          department: { select: { id: true, name: true, code: true } }
        },
        orderBy: { name: "asc" }
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: LeaveStatus.APPROVED,
          departmentId: query.departmentId,
          startsAt: { lte: dayEnd },
          endsAt: { gte: dayStart }
        },
        include: this.leaveInclude()
      })
    ]);

    const onLeaveIds = new Set(leaves.map((leave) => leave.employeeId));

    return {
      from: dayStart,
      to: dayEnd,
      totalEmployees: employees.length,
      onLeaveCount: onLeaveIds.size,
      availableCount: employees.filter((employee) => !onLeaveIds.has(employee.id)).length,
      onLeave: leaves,
      available: employees.filter((employee) => !onLeaveIds.has(employee.id))
    };
  }

  private resolveDuration(
    dto: Pick<CreateLeaveRequestDto, "durationType" | "durationHours" | "halfDayPeriod" | "startsAt" | "endsAt">,
    startsAt: Date,
    endsAt: Date
  ) {
    const durationType = dto.durationType ?? LeaveDurationType.FULL_DAY;

    if (durationType === LeaveDurationType.HALF_DAY) {
      this.ensureSameCalendarDay(startsAt, endsAt, "Half-day leave must start and end on the same day");

      return {
        durationType,
        durationDays: 0.5,
        durationHours: null,
        halfDayPeriod: dto.halfDayPeriod ?? LeaveHalfDayPeriod.MORNING
      };
    }

    if (durationType === LeaveDurationType.HOURS) {
      this.ensureSameCalendarDay(startsAt, endsAt, "Hourly permission must start and end on the same day");

      const durationHours = dto.durationHours;
      if (!durationHours) {
        throw new BadRequestException("Hourly permission requires duration hours");
      }

      return {
        durationType,
        durationDays: Math.round((durationHours / 8) * 100) / 100,
        durationHours,
        halfDayPeriod: null
      };
    }

    return {
      durationType: LeaveDurationType.FULL_DAY,
      durationDays: this.fullDayDuration(startsAt, endsAt),
      durationHours: null,
      halfDayPeriod: null
    };
  }

  private async ensureBalanceAvailable(
    companyId: string,
    employeeId: string,
    leaveType: Awaited<ReturnType<LeaveRequestsService["ensureLeaveType"]>>,
    year: number,
    durationDays: number
  ) {
    if (!leaveType.annualAllowanceDays) {
      return;
    }

    const balance = await this.ensureBalance(companyId, employeeId, leaveType.id, year, leaveType.annualAllowanceDays);

    if (Number(balance.remainingDays) < durationDays) {
      throw new BadRequestException("Leave balance is not sufficient for this request");
    }
  }

  private async consumeApprovedLeaveBalance(
    tx: Prisma.TransactionClient,
    companyId: string,
    leave: { employeeId: string; leaveTypeId: string | null; startsAt: Date; durationDays: Prisma.Decimal | number }
  ) {
    if (!leave.leaveTypeId) {
      return;
    }

    const leaveType = await tx.leaveType.findFirst({
      where: { companyId, id: leave.leaveTypeId, deletedAt: null }
    });

    if (!leaveType?.annualAllowanceDays) {
      return;
    }

    const year = leave.startsAt.getFullYear();
    const balance = await tx.leaveBalance.upsert({
      where: {
        companyId_employeeId_leaveTypeId_year: {
          companyId,
          employeeId: leave.employeeId,
          leaveTypeId: leave.leaveTypeId,
          year
        }
      },
      update: { deletedAt: null },
      create: {
        companyId,
        employeeId: leave.employeeId,
        leaveTypeId: leave.leaveTypeId,
        year,
        allocatedDays: leaveType.annualAllowanceDays,
        usedDays: 0,
        remainingDays: leaveType.annualAllowanceDays
      }
    });
    const durationDays = Number(leave.durationDays);
    const remainingDays = Number(balance.remainingDays);

    if (remainingDays < durationDays) {
      throw new BadRequestException("Leave balance is not sufficient for approval");
    }

    await tx.leaveBalance.update({
      where: { id: balance.id },
      data: {
        usedDays: Number(balance.usedDays) + durationDays,
        remainingDays: remainingDays - durationDays
      }
    });
  }

  private ensureBalance(companyId: string, employeeId: string, leaveTypeId: string, year: number, allocatedDays: number) {
    return this.prisma.leaveBalance.upsert({
      where: {
        companyId_employeeId_leaveTypeId_year: {
          companyId,
          employeeId,
          leaveTypeId,
          year
        }
      },
      update: { deletedAt: null },
      create: {
        companyId,
        employeeId,
        leaveTypeId,
        year,
        allocatedDays,
        usedDays: 0,
        remainingDays: allocatedDays
      }
    });
  }

  private fullDayDuration(startsAt: Date, endsAt: Date) {
    const start = Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth(), startsAt.getUTCDate());
    const end = Date.UTC(endsAt.getUTCFullYear(), endsAt.getUTCMonth(), endsAt.getUTCDate());

    return Math.max(1, Math.floor((end - start) / 86400000) + 1);
  }

  private ensureSameCalendarDay(startsAt: Date, endsAt: Date, message: string) {
    if (
      startsAt.getUTCFullYear() !== endsAt.getUTCFullYear() ||
      startsAt.getUTCMonth() !== endsAt.getUTCMonth() ||
      startsAt.getUTCDate() !== endsAt.getUTCDate()
    ) {
      throw new BadRequestException(message);
    }
  }

  private buildWhere(companyId: string, query: LeaveQueryDto): Prisma.LeaveRequestWhereInput {
    return {
      companyId,
      deletedAt: null,
      status: query.status,
      employeeId: query.employeeId,
      leaveTypeId: query.leaveTypeId,
      departmentId: query.departmentId,
      startsAt:
        query.startsFrom || query.startsTo
          ? {
              gte: query.startsFrom ? new Date(query.startsFrom) : undefined,
              lte: query.startsTo ? new Date(query.startsTo) : undefined
            }
          : undefined,
      OR: query.search
        ? [
            { leaveType: { contains: query.search, mode: "insensitive" } },
            { reason: { contains: query.search, mode: "insensitive" } },
            { employee: { name: { contains: query.search, mode: "insensitive" } } }
          ]
        : undefined
    };
  }

  private async ensureLeave(companyId: string, id: string) {
    const leave = await this.prisma.leaveRequest.findFirst({
      where: { companyId, id, deletedAt: null }
    });

    if (!leave) {
      throw new NotFoundException("Leave request not found");
    }

    return leave;
  }

  private async ensureLeaveType(companyId: string, id: string) {
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { companyId, id, isActive: true, deletedAt: null }
    });

    if (!leaveType) {
      throw new BadRequestException("Leave type does not belong to tenant");
    }

    return leaveType;
  }

  private async ensureUser(companyId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { companyId, id, deletedAt: null },
      select: { id: true, departmentId: true }
    });

    if (!user) {
      throw new BadRequestException("Employee does not belong to tenant");
    }

    return user;
  }

  private findActivities(companyId: string, id: string) {
    return this.prisma.activity.findMany({
      where: {
        companyId,
        deletedAt: null,
        metadata: {
          path: ["leaveRequestId"],
          equals: id
        }
      },
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { id: true, name: true, email: true } }
      }
    });
  }

  private publishLeaveEvent(name: string, companyId: string, actorId: string, leaveRequestId: string, payload: Record<string, unknown>) {
    this.eventBus.publish({
      name,
      companyId,
      actorId,
      entityType: EntityType.LEAVE_REQUEST,
      entityId: leaveRequestId,
      payload
    });
  }

  private leaveInclude() {
    return {
      employee: { select: { id: true, name: true, email: true, jobTitle: true } },
      department: { select: { id: true, name: true, code: true } },
      leaveTypeRef: { select: { id: true, name: true, code: true, isPaid: true } }
    } as const;
  }

  private leaveDetailInclude() {
    return this.leaveInclude();
  }
}
