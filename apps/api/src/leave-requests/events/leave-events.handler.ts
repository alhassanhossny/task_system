import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EntityType, NotificationType, Prisma } from "@prisma/client";
import { Subscription } from "rxjs";
import { ApprovalWorkflowsService } from "../../approval-workflows/approval-workflows.service";
import { DomainEvent } from "../../domain-events/domain-event";
import { DomainEventBus } from "../../domain-events/domain-event-bus.service";
import { PrismaService } from "../../prisma/prisma.service";
import { SearchIndexer } from "../../search/search-indexer.service";

const LEAVE_EVENTS = new Set([
  "LEAVE_SUBMITTED",
  "PERMISSION_REQUEST_SUBMITTED",
  "LEAVE_INFO_REQUESTED",
  "LEAVE_UPDATED",
  "LEAVE_APPROVAL_STEP_APPROVED",
  "LEAVE_APPROVED",
  "PERMISSION_REQUEST_APPROVED",
  "LEAVE_REJECTED",
  "PERMISSION_REQUEST_REJECTED",
  "LEAVE_CANCELLED",
  "LEAVE_COMMENTED",
  "LEAVE_ATTACHMENT_ADDED",
  "LEAVE_BALANCE_UPDATED",
  "LEAVE_ALLOCATED"
]);

@Injectable()
export class LeaveEventsHandler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeaveEventsHandler.name);
  private subscription?: Subscription;

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly prisma: PrismaService,
    private readonly searchIndexer: SearchIndexer,
    private readonly approvalWorkflows: ApprovalWorkflowsService
  ) {}

  onModuleInit() {
    this.subscription = this.eventBus.events$.subscribe((event) => {
      if (LEAVE_EVENTS.has(event.name)) {
        void this.handle(event).catch((error) => {
          this.logger.error(`Failed to handle ${event.name}`, error instanceof Error ? error.stack : undefined);
        });
      }
    });
  }

  onModuleDestroy() {
    this.subscription?.unsubscribe();
  }

  private async handle(event: DomainEvent) {
    if (event.name === "LEAVE_BALANCE_UPDATED" || event.name === "LEAVE_ALLOCATED") {
      await this.handleBalanceEvent(event);
      return;
    }

    if (event.entityType !== EntityType.LEAVE_REQUEST || !event.entityId) {
      return;
    }

    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id: event.entityId, companyId: event.companyId },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        department: { select: { name: true, code: true } },
        leaveTypeRef: { select: { name: true, code: true } }
      }
    });

    if (!leave) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.activity.create({
        data: {
          companyId: event.companyId,
          actorId: event.actorId,
          type: event.name,
          title: this.activityTitle(event.name, leave.employee.name, leave.leaveType),
          titleAr: this.activityTitleAr(event.name, leave.employee.name, leave.leaveType),
          metadata: (event.payload ?? {}) as Prisma.InputJsonValue
        }
      });

      await tx.auditLog.create({
        data: {
          companyId: event.companyId,
          actorId: event.actorId,
          action: event.name,
          entityType: EntityType.LEAVE_REQUEST,
          entityId: event.entityId,
          metadata: (event.payload ?? {}) as Prisma.InputJsonValue
        }
      });
    });

    if (event.name === "LEAVE_CANCELLED") {
      await this.searchIndexer.remove(event.companyId, EntityType.LEAVE_REQUEST, event.entityId);
    } else {
      const [comments, attachments] = await Promise.all([
        this.prisma.comment.findMany({
          where: { companyId: event.companyId, entityType: EntityType.LEAVE_REQUEST, entityId: leave.id, deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { content: true }
        }),
        this.prisma.attachment.findMany({
          where: { companyId: event.companyId, entityType: EntityType.LEAVE_REQUEST, entityId: leave.id, deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { fileName: true, mimeType: true, filePath: true }
        })
      ]);

      await this.searchIndexer.index({
        companyId: event.companyId,
        entityType: EntityType.LEAVE_REQUEST,
        entityId: leave.id,
        title: `${leave.requestNumber ?? ""} ${leave.employee.name} ${leave.leaveType}`.trim(),
        content: [
          leave.requestNumber,
          leave.employee.name,
          leave.employee.email,
          leave.leaveType,
          leave.leaveTypeRef?.code,
          leave.department?.name,
          leave.department?.code,
          leave.reason,
          ...comments.map((comment) => comment.content),
          ...attachments.flatMap((attachment) => [attachment.fileName, attachment.mimeType, attachment.filePath])
        ]
          .filter(Boolean)
          .join("\n")
      });
    }

    if (event.name === "LEAVE_SUBMITTED" || event.name === "PERMISSION_REQUEST_SUBMITTED") {
      const approverIds = await this.approvalWorkflows.nextApproverUserIds(event.companyId, EntityType.LEAVE_REQUEST, event.entityId);
      await this.notifyUsers(event, NotificationType.LEAVE_SUBMITTED, approverIds, "Time-off request submitted", `${leave.employee.name} submitted a time-off request.`);
    }

    if (event.name === "LEAVE_APPROVAL_STEP_APPROVED") {
      const approverIds = await this.approvalWorkflows.nextApproverUserIds(event.companyId, EntityType.LEAVE_REQUEST, event.entityId);
      await this.notifyUsers(event, NotificationType.LEAVE_SUBMITTED, approverIds, "Leave request awaiting approval", `${leave.employee.name}'s leave request is waiting for your approval.`);
    }

    if (event.name === "LEAVE_INFO_REQUESTED") {
      await this.notifyUsers(event, NotificationType.LEAVE_INFO_REQUESTED, [leave.employeeId], "Leave request needs more information", "Your manager requested more information for your leave request.");
    }

    if (event.name === "LEAVE_APPROVED" || event.name === "PERMISSION_REQUEST_APPROVED") {
      await this.notifyUsers(event, NotificationType.LEAVE_APPROVED, [leave.employeeId], "Leave request approved", "Your leave request was approved.");
    }

    if (event.name === "LEAVE_REJECTED" || event.name === "PERMISSION_REQUEST_REJECTED") {
      await this.notifyUsers(event, NotificationType.LEAVE_REJECTED, [leave.employeeId], "Leave request rejected", "Your leave request was rejected.");
    }

    if (event.name === "LEAVE_CANCELLED") {
      const approverIds = await this.approvalWorkflows.nextApproverUserIds(event.companyId, EntityType.LEAVE_REQUEST, event.entityId);
      await this.notifyUsers(event, NotificationType.LEAVE_CANCELLED, [leave.employeeId, ...approverIds], "Leave request cancelled", `${leave.employee.name}'s leave request was cancelled.`);
    }
  }

  private async handleBalanceEvent(event: DomainEvent) {
    await this.prisma.$transaction(async (tx) => {
      await tx.activity.create({
        data: {
          companyId: event.companyId,
          actorId: event.actorId,
          type: event.name,
          title: event.name === "LEAVE_ALLOCATED" ? "Leave balance allocated" : "Leave balance updated",
          titleAr: event.name === "LEAVE_ALLOCATED" ? "تم تخصيص رصيد إجازات" : "تم تحديث رصيد الإجازات",
          metadata: (event.payload ?? {}) as Prisma.InputJsonValue
        }
      });

      await tx.auditLog.create({
        data: {
          companyId: event.companyId,
          actorId: event.actorId,
          action: event.name,
          entityType: "LEAVE_BALANCE",
          entityId: (event.payload?.balanceId as string | undefined) ?? null,
          metadata: (event.payload ?? {}) as Prisma.InputJsonValue
        }
      });
    });
  }

  private async notifyUsers(event: DomainEvent, type: NotificationType, userIds: string[], title: string, message: string) {
    const recipients = [...new Set(userIds)].filter((userId) => userId && userId !== event.actorId);

    if (!recipients.length) {
      return;
    }

    await this.prisma.notification.createMany({
      data: recipients.map((userId) => ({
        companyId: event.companyId,
        userId,
        type,
        title,
        message,
        entityType: EntityType.LEAVE_REQUEST,
        entityId: event.entityId
      }))
    });
  }

  private activityTitle(eventName: string, employeeName: string, leaveType: string) {
    const actions: Record<string, string> = {
      LEAVE_SUBMITTED: "Submitted",
      PERMISSION_REQUEST_SUBMITTED: "Submitted permission request",
      LEAVE_INFO_REQUESTED: "Requested more information for",
      LEAVE_UPDATED: "Updated",
      LEAVE_APPROVAL_STEP_APPROVED: "Approved a step for",
      LEAVE_APPROVED: "Approved",
      PERMISSION_REQUEST_APPROVED: "Approved permission request",
      LEAVE_REJECTED: "Rejected",
      PERMISSION_REQUEST_REJECTED: "Rejected permission request",
      LEAVE_CANCELLED: "Cancelled",
      LEAVE_COMMENTED: "Commented on",
      LEAVE_ATTACHMENT_ADDED: "Added an attachment to"
    };

    return `${actions[eventName] ?? "Updated"} ${employeeName}'s ${leaveType}`;
  }

  private activityTitleAr(eventName: string, employeeName: string, leaveType: string) {
    const actions: Record<string, string> = {
      LEAVE_SUBMITTED: "تم تقديم",
      PERMISSION_REQUEST_SUBMITTED: "تم تقديم استئذان",
      LEAVE_INFO_REQUESTED: "تم طلب معلومات إضافية حول",
      LEAVE_UPDATED: "تم تحديث",
      LEAVE_APPROVAL_STEP_APPROVED: "تمت الموافقة على خطوة في",
      LEAVE_APPROVED: "تمت الموافقة على",
      PERMISSION_REQUEST_APPROVED: "تمت الموافقة على استئذان",
      LEAVE_REJECTED: "تم رفض",
      PERMISSION_REQUEST_REJECTED: "تم رفض استئذان",
      LEAVE_CANCELLED: "تم إلغاء",
      LEAVE_COMMENTED: "تم التعليق على",
      LEAVE_ATTACHMENT_ADDED: "تمت إضافة مرفق إلى"
    };

    return `${actions[eventName] ?? "تم تحديث"} طلب ${leaveType} للموظف ${employeeName}`;
  }
}
