import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EntityType, LeaveStatus, Prisma } from "@prisma/client";
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
import { LeaveQueryDto } from "./dto/leave-query.dto";
import { UpdateLeaveRequestDto } from "./dto/update-leave-request.dto";
import { UpdateLeaveTypeDto } from "./dto/update-leave-type.dto";

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
    private readonly approvalWorkflows: ApprovalWorkflowsService,
    private readonly commentsService: CommentsService,
    private readonly attachmentsService: AttachmentsService
  ) {}

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

    const leave = await this.prisma.leaveRequest.create({
      data: {
        companyId,
        employeeId,
        departmentId: employee.departmentId,
        leaveTypeId: leaveType.id,
        leaveType: leaveType.name,
        startsAt,
        endsAt,
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
      endsAt: leave.endsAt
    });

    return this.findOne(companyId, leave.id);
  }

  async update(companyId: string, actorId: string, id: string, dto: UpdateLeaveRequestDto) {
    const existing = await this.ensureLeave(companyId, id);

    if (existing.status !== LeaveStatus.PENDING) {
      throw new BadRequestException("Only pending leave requests can be updated");
    }

    const leaveType = dto.leaveTypeId ? await this.ensureLeaveType(companyId, dto.leaveTypeId) : null;
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;

    if (endsAt < startsAt) {
      throw new BadRequestException("Leave end date must be after start date");
    }

    const leave = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        leaveTypeId: leaveType?.id,
        leaveType: leaveType?.name,
        startsAt: dto.startsAt ? startsAt : undefined,
        endsAt: dto.endsAt ? endsAt : undefined,
        reason: dto.reason
      },
      include: this.leaveDetailInclude()
    });

    this.publishLeaveEvent("LEAVE_UPDATED", companyId, actorId, id, {
      leaveRequestId: id,
      leaveType: leave.leaveType
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
      ? await this.prisma.leaveRequest.update({
          where: { id },
          data: { status: LeaveStatus.APPROVED, approvedAt: new Date() },
          include: this.leaveDetailInclude()
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

  private buildWhere(companyId: string, query: LeaveQueryDto): Prisma.LeaveRequestWhereInput {
    return {
      companyId,
      deletedAt: null,
      status: query.status,
      employeeId: query.employeeId,
      leaveTypeId: query.leaveTypeId,
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
