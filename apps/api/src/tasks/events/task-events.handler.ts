import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EntityType, NotificationType, Prisma } from "@prisma/client";
import { Subscription } from "rxjs";
import { DomainEvent } from "../../domain-events/domain-event";
import { DomainEventBus } from "../../domain-events/domain-event-bus.service";
import { PrismaService } from "../../prisma/prisma.service";
import { SearchIndexer } from "../../search/search-indexer.service";

const TASK_EVENTS = new Set([
  "TASK_CREATED",
  "TASK_ASSIGNED",
  "TASK_UPDATED",
  "TASK_COMPLETED",
  "TASK_DELETED",
  "TASK_COMMENTED",
  "TASK_ATTACHMENT_ADDED"
]);

@Injectable()
export class TaskEventsHandler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskEventsHandler.name);
  private subscription?: Subscription;

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly prisma: PrismaService,
    private readonly searchIndexer: SearchIndexer
  ) {}

  onModuleInit() {
    this.subscription = this.eventBus.events$.subscribe((event) => {
      if (TASK_EVENTS.has(event.name)) {
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
    if (event.entityType !== EntityType.TASK || !event.entityId) {
      return;
    }

    const task = await this.prisma.task.findFirst({
      where: { id: event.entityId, companyId: event.companyId },
      include: {
        assignees: {
          where: { deletedAt: null },
          select: { userId: true }
        },
        watchers: {
          where: { deletedAt: null },
          select: { userId: true }
        }
      }
    });

    if (!task && event.name !== "TASK_DELETED") {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.activity.create({
        data: {
          companyId: event.companyId,
          actorId: event.actorId,
          type: event.name,
          title: this.activityTitle(event.name, task?.taskNumber ?? this.payloadString(event, "taskNumber"), task?.title ?? this.payloadString(event, "title")),
          titleAr: this.activityTitleAr(event.name, task?.taskNumber ?? this.payloadString(event, "taskNumber")),
          metadata: (event.payload ?? {}) as Prisma.InputJsonValue
        }
      });

      await tx.auditLog.create({
        data: {
          companyId: event.companyId,
          actorId: event.actorId,
          action: event.name,
          entityType: EntityType.TASK,
          entityId: event.entityId,
          metadata: (event.payload ?? {}) as Prisma.InputJsonValue
        }
      });
    });

    if (event.name === "TASK_DELETED") {
      await this.searchIndexer.remove(event.companyId, EntityType.TASK, event.entityId);
      return;
    }

    if (task) {
      await this.searchIndexer.index({
        companyId: event.companyId,
        entityType: EntityType.TASK,
        entityId: task.id,
        title: `${task.taskNumber} ${task.title}`,
        content: [task.taskNumber, task.title, task.description].filter(Boolean).join("\n")
      });
    }

    if (event.name === "TASK_ASSIGNED") {
      await this.notifyUsers(event, NotificationType.TASK_ASSIGNED, this.payloadArray(event, "assigneeIds"), "Task assigned", "A task was assigned to you.");
    }

    if (event.name === "TASK_COMPLETED" && task) {
      const userIds = this.uniqueIds([task.createdById, ...task.assignees.map((assignee) => assignee.userId), ...task.watchers.map((watcher) => watcher.userId)]);
      await this.notifyUsers(event, NotificationType.TASK_COMPLETED, userIds, "Task completed", `${task.taskNumber} was completed.`);
    }
  }

  private async notifyUsers(event: DomainEvent, type: NotificationType, userIds: string[], title: string, message: string) {
    const recipients = this.uniqueIds(userIds).filter((userId) => userId !== event.actorId);

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
        entityType: EntityType.TASK,
        entityId: event.entityId
      }))
    });
  }

  private activityTitle(eventName: string, taskNumber?: string, title?: string) {
    const label = [taskNumber, title].filter(Boolean).join(" - ") || "task";
    const actions: Record<string, string> = {
      TASK_CREATED: "Created",
      TASK_ASSIGNED: "Assigned",
      TASK_UPDATED: "Updated",
      TASK_COMPLETED: "Completed",
      TASK_DELETED: "Deleted",
      TASK_COMMENTED: "Commented on",
      TASK_ATTACHMENT_ADDED: "Added an attachment to"
    };

    return `${actions[eventName] ?? "Updated"} ${label}`;
  }

  private activityTitleAr(eventName: string, taskNumber?: string) {
    const label = taskNumber ?? "المهمة";
    const actions: Record<string, string> = {
      TASK_CREATED: "تم إنشاء",
      TASK_ASSIGNED: "تم تعيين",
      TASK_UPDATED: "تم تحديث",
      TASK_COMPLETED: "تم إكمال",
      TASK_DELETED: "تم حذف",
      TASK_COMMENTED: "تم التعليق على",
      TASK_ATTACHMENT_ADDED: "تمت إضافة مرفق إلى"
    };

    return `${actions[eventName] ?? "تم تحديث"} ${label}`;
  }

  private payloadString(event: DomainEvent, key: string) {
    const value = event.payload?.[key];
    return typeof value === "string" ? value : undefined;
  }

  private payloadArray(event: DomainEvent, key: string) {
    const value = event.payload?.[key];
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  }

  private uniqueIds(ids: Array<string | null | undefined>) {
    return [...new Set(ids.filter((id): id is string => Boolean(id)))];
  }
}
