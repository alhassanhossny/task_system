import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EntityType, NotificationType, Prisma } from "@prisma/client";
import { Subscription } from "rxjs";
import { DomainEvent } from "../../domain-events/domain-event";
import { DomainEventBus } from "../../domain-events/domain-event-bus.service";
import { PrismaService } from "../../prisma/prisma.service";
import { SearchIndexer } from "../../search/search-indexer.service";

const TEAM_EVENTS = new Set(["TEAM_LEAVE_APPROVED", "TEAM_LEAVE_REJECTED", "TEAM_MEMBER_ASSIGNED"]);

@Injectable()
export class TeamEventsHandler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TeamEventsHandler.name);
  private subscription?: Subscription;

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly prisma: PrismaService,
    private readonly searchIndexer: SearchIndexer
  ) {}

  onModuleInit() {
    this.subscription = this.eventBus.events$.subscribe((event) => {
      if (TEAM_EVENTS.has(event.name)) {
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
    if (event.name === "TEAM_MEMBER_ASSIGNED") {
      await this.handleMemberAssigned(event);
      return;
    }

    await this.handleTeamLeaveEvent(event);
  }

  private async handleTeamLeaveEvent(event: DomainEvent) {
    if (event.entityType !== EntityType.LEAVE_REQUEST || !event.entityId) {
      return;
    }

    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id: event.entityId, companyId: event.companyId, deletedAt: null },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            manager: { select: { id: true, name: true, email: true } }
          }
        },
        department: { select: { id: true, name: true, code: true } },
        leaveTypeRef: { select: { id: true, name: true, code: true } }
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
          title: this.teamLeaveTitle(event.name, leave.employee.name, leave.leaveType),
          titleAr: this.teamLeaveTitleAr(event.name, leave.employee.name, leave.leaveType),
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

    await this.searchIndexer.index({
      companyId: event.companyId,
      entityType: EntityType.LEAVE_REQUEST,
      entityId: leave.id,
      title: `${leave.requestNumber ?? ""} ${leave.employee.name} ${leave.leaveType}`.trim(),
      content: [
        leave.requestNumber,
        leave.employee.manager?.name,
        leave.employee.manager?.email,
        leave.employee.name,
        leave.employee.email,
        leave.department?.name,
        leave.department?.code,
        leave.leaveType,
        leave.leaveTypeRef?.code,
        leave.status,
        leave.reason
      ]
        .filter(Boolean)
        .join("\n")
    });
  }

  private async handleMemberAssigned(event: DomainEvent) {
    if (event.entityType !== EntityType.USER || !event.entityId) {
      return;
    }

    const member = await this.prisma.user.findFirst({
      where: { id: event.entityId, companyId: event.companyId, deletedAt: null },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true, code: true } }
      }
    });

    if (!member) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.activity.create({
        data: {
          companyId: event.companyId,
          actorId: event.actorId,
          type: event.name,
          title: `${member.name} assigned to ${member.manager?.name ?? "manager"}`,
          titleAr: `تم تعيين ${member.name} إلى ${member.manager?.name ?? "مدير"}`,
          metadata: (event.payload ?? {}) as Prisma.InputJsonValue
        }
      });

      await tx.auditLog.create({
        data: {
          companyId: event.companyId,
          actorId: event.actorId,
          action: event.name,
          entityType: EntityType.USER,
          entityId: member.id,
          metadata: (event.payload ?? {}) as Prisma.InputJsonValue
        }
      });

      if (member.managerId && member.id !== event.actorId) {
        await tx.notification.create({
          data: {
            companyId: event.companyId,
            userId: member.id,
            type: NotificationType.SYSTEM,
            title: "Manager assigned",
            message: `${member.manager?.name ?? "A manager"} is now your manager.`,
            entityType: EntityType.USER,
            entityId: member.id
          }
        });
      }
    });

    await this.searchIndexer.index({
      companyId: event.companyId,
      entityType: EntityType.USER,
      entityId: member.id,
      title: member.name,
      content: [member.name, member.email, member.jobTitle, member.department?.name, member.department?.code, member.manager?.name, member.manager?.email]
        .filter(Boolean)
        .join("\n")
    });
  }

  private teamLeaveTitle(eventName: string, employeeName: string, leaveType: string) {
    return eventName === "TEAM_LEAVE_REJECTED"
      ? `Rejected ${employeeName}'s ${leaveType}`
      : `Approved ${employeeName}'s ${leaveType}`;
  }

  private teamLeaveTitleAr(eventName: string, employeeName: string, leaveType: string) {
    return eventName === "TEAM_LEAVE_REJECTED" ? `تم رفض ${leaveType} لـ ${employeeName}` : `تمت الموافقة على ${leaveType} لـ ${employeeName}`;
  }
}
