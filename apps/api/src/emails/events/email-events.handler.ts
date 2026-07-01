import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EntityType, NotificationType, Prisma } from "@prisma/client";
import { Subscription } from "rxjs";
import { DomainEvent } from "../../domain-events/domain-event";
import { DomainEventBus } from "../../domain-events/domain-event-bus.service";
import { PrismaService } from "../../prisma/prisma.service";
import { SearchIndexer } from "../../search/search-indexer.service";

const EMAIL_EVENTS = new Set([
  "EMAIL_CREATED",
  "EMAIL_UPDATED",
  "EMAIL_QUEUED",
  "EMAIL_SENT",
  "EMAIL_FAILED",
  "EMAIL_CANCELLED",
  "EMAIL_RETRIED",
  "EMAIL_DELETED",
  "EMAIL_ATTACHMENT_ADDED"
]);

@Injectable()
export class EmailEventsHandler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailEventsHandler.name);
  private subscription?: Subscription;

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly prisma: PrismaService,
    private readonly searchIndexer: SearchIndexer
  ) {}

  onModuleInit() {
    this.subscription = this.eventBus.events$.subscribe((event) => {
      if (EMAIL_EVENTS.has(event.name)) {
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
    if (event.entityType !== EntityType.EMAIL || !event.entityId) {
      return;
    }

    const email = await this.prisma.email.findFirst({
      where: { id: event.entityId, companyId: event.companyId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        template: {
          select: {
            name: true
          }
        },
        recipients: {
          where: { deletedAt: null }
        },
        attachments: {
          where: { deletedAt: null },
          include: {
            attachment: true
          }
        }
      }
    });

    if (!email && event.name !== "EMAIL_DELETED") {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.activity.create({
        data: {
          companyId: event.companyId,
          actorId: event.actorId,
          type: event.name,
          title: this.activityTitle(event.name, email?.subject ?? this.payloadString(event, "subject")),
          titleAr: this.activityTitleAr(event.name),
          metadata: (event.payload ?? {}) as Prisma.InputJsonValue
        }
      });

      await tx.auditLog.create({
        data: {
          companyId: event.companyId,
          actorId: event.actorId,
          action: event.name,
          entityType: EntityType.EMAIL,
          entityId: event.entityId,
          metadata: (event.payload ?? {}) as Prisma.InputJsonValue
        }
      });
    });

    if (event.name === "EMAIL_DELETED") {
      await this.searchIndexer.remove(event.companyId, EntityType.EMAIL, event.entityId);
      return;
    }

    if (email) {
      await this.searchIndexer.index({
        companyId: event.companyId,
        entityType: EntityType.EMAIL,
        entityId: email.id,
        title: email.subject,
        content: [
          email.subject,
          email.body,
          email.status,
          email.createdBy?.name,
          email.createdBy?.email,
          email.template?.name,
          ...email.recipients.flatMap((recipient) => [recipient.name, recipient.email, recipient.recipientKind, recipient.recipientType]),
          ...email.attachments.flatMap((link) => [link.attachment.fileName, link.attachment.mimeType, link.attachment.filePath])
        ]
          .filter(Boolean)
          .join("\n")
      });
    }

    if (email && event.name === "EMAIL_QUEUED") {
      await this.notifyUser(event, email.createdById, NotificationType.EMAIL_QUEUED, "Email queued", `${email.subject} was queued for delivery.`);
    }

    if (email && event.name === "EMAIL_SENT") {
      await this.notifyUser(event, email.createdById, NotificationType.EMAIL_SENT, "Email sent", `${email.subject} was sent.`);
    }

    if (email && event.name === "EMAIL_FAILED") {
      await this.notifyUser(event, email.createdById, NotificationType.EMAIL_FAILED, "Email failed", `${email.subject} failed to send.`);
    }
  }

  private async notifyUser(event: DomainEvent, userId: string | null, type: NotificationType, title: string, message: string) {
    if (!userId) {
      return;
    }

    await this.prisma.notification.create({
      data: {
        companyId: event.companyId,
        userId,
        type,
        title,
        message,
        entityType: EntityType.EMAIL,
        entityId: event.entityId
      }
    });
  }

  private activityTitle(eventName: string, subject?: string) {
    const label = subject || "email";
    const actions: Record<string, string> = {
      EMAIL_CREATED: "Created",
      EMAIL_UPDATED: "Updated",
      EMAIL_QUEUED: "Queued",
      EMAIL_SENT: "Sent",
      EMAIL_FAILED: "Failed",
      EMAIL_CANCELLED: "Cancelled",
      EMAIL_RETRIED: "Retried",
      EMAIL_DELETED: "Deleted",
      EMAIL_ATTACHMENT_ADDED: "Added an attachment to"
    };

    return `${actions[eventName] ?? "Updated"} ${label}`;
  }

  private activityTitleAr(eventName: string) {
    const actions: Record<string, string> = {
      EMAIL_CREATED: "تم إنشاء البريد",
      EMAIL_UPDATED: "تم تحديث البريد",
      EMAIL_QUEUED: "تمت جدولة البريد",
      EMAIL_SENT: "تم إرسال البريد",
      EMAIL_FAILED: "فشل إرسال البريد",
      EMAIL_CANCELLED: "تم إلغاء البريد",
      EMAIL_RETRIED: "تمت إعادة محاولة الإرسال",
      EMAIL_DELETED: "تم حذف البريد",
      EMAIL_ATTACHMENT_ADDED: "تمت إضافة مرفق للبريد"
    };

    return actions[eventName] ?? "تم تحديث البريد";
  }

  private payloadString(event: DomainEvent, key: string) {
    const value = event.payload?.[key];
    return typeof value === "string" ? value : undefined;
  }
}
