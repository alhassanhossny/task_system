import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EmailRecipientKind, EmailRecipientType, EmailStatus, EntityType, Prisma } from "@prisma/client";
import { AttachmentsService } from "../attachments/attachments.service";
import { DomainEventBus } from "../domain-events/domain-event-bus.service";
import { EmailProvider, EMAIL_PROVIDER, EmailProviderAddress, EmailProviderMessage } from "../email-providers/email-provider";
import { PrismaService } from "../prisma/prisma.service";
import { EmailQueue } from "../queues/email.queue";
import { CreateEmailDto } from "./dto/create-email.dto";
import { EmailAttachmentDto } from "./dto/email-attachment.dto";
import { EmailQueryDto } from "./dto/email-query.dto";
import { EmailRecipientDto } from "./dto/email-recipient.dto";
import { UpdateEmailDto } from "./dto/update-email.dto";

const ALLOWED_EMAIL_TRANSITIONS: Record<EmailStatus, EmailStatus[]> = {
  [EmailStatus.DRAFT]: [EmailStatus.QUEUED, EmailStatus.CANCELLED],
  [EmailStatus.QUEUED]: [EmailStatus.SENDING, EmailStatus.CANCELLED],
  [EmailStatus.SENDING]: [EmailStatus.SENT, EmailStatus.FAILED],
  [EmailStatus.SENT]: [],
  [EmailStatus.FAILED]: [EmailStatus.QUEUED, EmailStatus.CANCELLED],
  [EmailStatus.CANCELLED]: []
};

interface NormalizedRecipient {
  recipientType: EmailRecipientType;
  recipientKind: EmailRecipientKind;
  email: string;
  name?: string;
  userId?: string;
}

@Injectable()
export class EmailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
    private readonly attachmentsService: AttachmentsService,
    private readonly emailQueue: EmailQueue,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider
  ) {}

  async findAll(companyId: string, query: EmailQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.email.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: this.emailListInclude()
      }),
      this.prisma.email.count({ where })
    ]);

    return { items, total, page, limit };
  }

  async findOne(companyId: string, id: string) {
    const email = await this.prisma.email.findFirst({
      where: { id, companyId, deletedAt: null },
      include: this.emailDetailInclude()
    });

    if (!email) {
      throw new NotFoundException("Email not found");
    }

    const activities = await this.prisma.activity.findMany({
      where: {
        companyId,
        deletedAt: null,
        metadata: {
          path: ["emailId"],
          equals: id
        }
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return { ...email, activities };
  }

  async create(companyId: string, actorId: string, dto: CreateEmailDto) {
    const { subject, body, templateId } = await this.resolveSubjectAndBody(companyId, dto.templateId, dto.subject, dto.body, dto.variables);
    const recipients = await this.normalizeRecipients(companyId, dto.recipients ?? []);

    const email = await this.prisma.email.create({
      data: {
        companyId,
        createdById: actorId,
        templateId,
        subject,
        body,
        replyTo: dto.replyTo,
        status: EmailStatus.DRAFT,
        recipients: {
          create: recipients.map((recipient) => ({
            companyId,
            recipientType: recipient.recipientType,
            recipientKind: recipient.recipientKind,
            email: recipient.email,
            name: recipient.name,
            userId: recipient.userId
          }))
        }
      },
      include: this.emailDetailInclude()
    });

    if (dto.attachments?.length) {
      await this.replaceAttachments(companyId, actorId, email.id, dto.attachments);
    }

    this.publishEmailEvent("EMAIL_CREATED", companyId, actorId, email.id, {
      emailId: email.id,
      subject,
      status: EmailStatus.DRAFT,
      recipientCount: recipients.length
    });

    return this.findOne(companyId, email.id);
  }

  async update(companyId: string, actorId: string, id: string, dto: UpdateEmailDto) {
    const existing = await this.ensureEmail(companyId, id);

    if (existing.status !== EmailStatus.DRAFT && existing.status !== EmailStatus.FAILED) {
      throw new BadRequestException("Only draft or failed emails can be updated");
    }

    const resolved =
      dto.templateId !== undefined || dto.subject !== undefined || dto.body !== undefined || dto.variables
        ? await this.resolveSubjectAndBody(companyId, dto.templateId ?? existing.templateId, dto.subject ?? existing.subject, dto.body ?? existing.body, dto.variables)
        : { subject: undefined, body: undefined, templateId: undefined as string | undefined };

    const recipients = dto.recipients ? await this.normalizeRecipients(companyId, dto.recipients) : null;

    const email = await this.prisma.$transaction(async (tx) => {
      await tx.email.update({
        where: { id },
        data: {
          subject: resolved.subject,
          body: resolved.body,
          templateId: dto.templateId === null ? null : resolved.templateId,
          replyTo: dto.replyTo === undefined ? undefined : dto.replyTo,
          status: existing.status === EmailStatus.FAILED ? EmailStatus.DRAFT : undefined,
          failedAt: existing.status === EmailStatus.FAILED ? null : undefined,
          failureReason: existing.status === EmailStatus.FAILED ? null : undefined
        }
      });

      if (recipients) {
        await tx.emailRecipient.updateMany({
          where: { companyId, emailId: id, deletedAt: null },
          data: { deletedAt: new Date() }
        });

        await tx.emailRecipient.createMany({
          data: recipients.map((recipient) => ({
            companyId,
            emailId: id,
            recipientType: recipient.recipientType,
            recipientKind: recipient.recipientKind,
            email: recipient.email,
            name: recipient.name,
            userId: recipient.userId
          }))
        });
      }

      return tx.email.findUniqueOrThrow({
        where: { id },
        include: this.emailDetailInclude()
      });
    });

    if (dto.attachments) {
      await this.replaceAttachments(companyId, actorId, id, dto.attachments);
    }

    this.publishEmailEvent("EMAIL_UPDATED", companyId, actorId, id, {
      emailId: id,
      subject: email.subject,
      status: email.status
    });

    return this.findOne(companyId, id);
  }

  async queue(companyId: string, actorId: string, id: string) {
    const existing = await this.ensureEmail(companyId, id);
    this.ensureTransition(existing.status, EmailStatus.QUEUED);
    await this.ensureSendable(companyId, id);

    const email = await this.prisma.email.update({
      where: { id },
      data: {
        status: EmailStatus.QUEUED,
        queuedAt: new Date(),
        failedAt: null,
        failureReason: null
      },
      include: this.emailDetailInclude()
    });

    await this.emailQueue.enqueueSendEmail({
      companyId,
      emailMessageId: id,
      requestedById: actorId
    });

    this.publishEmailEvent("EMAIL_QUEUED", companyId, actorId, id, {
      emailId: id,
      subject: email.subject,
      status: email.status
    });

    return email;
  }

  async cancel(companyId: string, actorId: string, id: string) {
    const existing = await this.ensureEmail(companyId, id);
    this.ensureTransition(existing.status, EmailStatus.CANCELLED);

    const email = await this.prisma.email.update({
      where: { id },
      data: {
        status: EmailStatus.CANCELLED,
        cancelledAt: new Date()
      },
      include: this.emailDetailInclude()
    });

    this.publishEmailEvent("EMAIL_CANCELLED", companyId, actorId, id, {
      emailId: id,
      subject: email.subject,
      status: email.status
    });

    return email;
  }

  async retry(companyId: string, actorId: string, id: string) {
    const existing = await this.ensureEmail(companyId, id);

    if (existing.status !== EmailStatus.FAILED) {
      throw new BadRequestException("Only failed emails can be retried");
    }

    const email = await this.prisma.email.update({
      where: { id },
      data: {
        status: EmailStatus.QUEUED,
        queuedAt: new Date(),
        failedAt: null,
        failureReason: null
      },
      include: this.emailDetailInclude()
    });

    await this.emailQueue.enqueueSendEmail({
      companyId,
      emailMessageId: id,
      requestedById: actorId
    });

    this.publishEmailEvent("EMAIL_RETRIED", companyId, actorId, id, {
      emailId: id,
      subject: email.subject,
      status: email.status
    });

    return email;
  }

  async softDelete(companyId: string, actorId: string, id: string) {
    const existing = await this.ensureEmail(companyId, id);

    if (existing.status === EmailStatus.QUEUED || existing.status === EmailStatus.SENDING) {
      throw new BadRequestException("Queued or sending emails cannot be deleted");
    }

    await this.prisma.email.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    this.publishEmailEvent("EMAIL_DELETED", companyId, actorId, id, {
      emailId: id,
      subject: existing.subject
    });

    return { success: true };
  }

  async findAttachments(companyId: string, id: string) {
    await this.ensureEmail(companyId, id);
    return this.attachmentsService.findByEntity(companyId, EntityType.EMAIL, id);
  }

  async addAttachment(companyId: string, actorId: string, id: string, dto: EmailAttachmentDto) {
    await this.ensureEmail(companyId, id);
    const attachment = await this.attachmentsService.create(companyId, actorId, {
      entityType: EntityType.EMAIL,
      entityId: id,
      fileName: dto.fileName,
      filePath: dto.filePath,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize,
      uploadedById: dto.uploadedById
    });

    await this.prisma.emailAttachment.upsert({
      where: {
        companyId_emailId_attachmentId: {
          companyId,
          emailId: id,
          attachmentId: attachment.id
        }
      },
      update: { deletedAt: null },
      create: { companyId, emailId: id, attachmentId: attachment.id }
    });

    this.publishEmailEvent("EMAIL_ATTACHMENT_ADDED", companyId, actorId, id, {
      emailId: id,
      attachmentId: attachment.id
    });

    return attachment;
  }

  async processQueuedEmail(companyId: string, id: string, requestedById: string) {
    const existing = await this.ensureEmail(companyId, id);

    if (existing.status !== EmailStatus.QUEUED) {
      return this.findOne(companyId, id);
    }

    await this.prisma.email.update({
      where: { id },
      data: { status: EmailStatus.SENDING }
    });

    const email = await this.findOne(companyId, id);
    const providerMessage = this.toProviderMessage(companyId, email);

    try {
      const result = await this.emailProvider.send(providerMessage);
      const sent = await this.prisma.email.update({
        where: { id },
        data: {
          status: EmailStatus.SENT,
          sentAt: new Date(),
          failedAt: null,
          failureReason: null,
          provider: result.provider,
          providerMessageId: result.externalId
        },
        include: this.emailDetailInclude()
      });

      this.publishEmailEvent("EMAIL_SENT", companyId, requestedById, id, {
        emailId: id,
        subject: sent.subject,
        accepted: result.accepted,
        rejected: result.rejected,
        status: sent.status
      });

      return sent;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email delivery failed";
      const failed = await this.prisma.email.update({
        where: { id },
        data: {
          status: EmailStatus.FAILED,
          failedAt: new Date(),
          failureReason: message
        },
        include: this.emailDetailInclude()
      });

      this.publishEmailEvent("EMAIL_FAILED", companyId, requestedById, id, {
        emailId: id,
        subject: failed.subject,
        failureReason: message,
        status: failed.status
      });

      throw error;
    }
  }

  private buildWhere(companyId: string, query: EmailQueryDto): Prisma.EmailWhereInput {
    return {
      companyId,
      deletedAt: null,
      status: query.status,
      createdAt:
        query.createdFrom || query.createdTo
          ? {
              gte: query.createdFrom ? new Date(query.createdFrom) : undefined,
              lte: query.createdTo ? new Date(query.createdTo) : undefined
            }
          : undefined,
      OR: query.search
        ? [
            { subject: { contains: query.search, mode: "insensitive" } },
            { body: { contains: query.search, mode: "insensitive" } },
            { recipients: { some: { email: { contains: query.search, mode: "insensitive" }, deletedAt: null } } },
            { recipients: { some: { name: { contains: query.search, mode: "insensitive" }, deletedAt: null } } }
          ]
        : undefined
    };
  }

  private async ensureEmail(companyId: string, id: string) {
    const email = await this.prisma.email.findFirst({
      where: { id, companyId, deletedAt: null }
    });

    if (!email) {
      throw new NotFoundException("Email not found");
    }

    return email;
  }

  private ensureTransition(from: EmailStatus, to: EmailStatus) {
    if (!ALLOWED_EMAIL_TRANSITIONS[from].includes(to)) {
      throw new BadRequestException(`Invalid email status transition from ${from} to ${to}`);
    }
  }

  private async ensureSendable(companyId: string, emailId: string) {
    const [toCount, smtpSetting] = await Promise.all([
      this.prisma.emailRecipient.count({
        where: { companyId, emailId, recipientKind: EmailRecipientKind.TO, deletedAt: null }
      }),
      this.prisma.smtpSetting.findFirst({ where: { companyId, deletedAt: null } })
    ]);

    if (!toCount) {
      throw new BadRequestException("Email must have at least one TO recipient");
    }

    if (!smtpSetting) {
      throw new BadRequestException("SMTP settings are required before sending email");
    }
  }

  private async normalizeRecipients(companyId: string, recipients: EmailRecipientDto[]) {
    if (!recipients.length) {
      throw new BadRequestException("At least one recipient is required");
    }

    const normalized: NormalizedRecipient[] = [];
    const userIds = recipients.map((recipient) => recipient.userId).filter((userId): userId is string => Boolean(userId));
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { companyId, id: { in: [...new Set(userIds)] }, deletedAt: null },
          select: { id: true, name: true, email: true }
        })
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    for (const recipient of recipients) {
      const user = recipient.userId ? usersById.get(recipient.userId) : null;

      if (recipient.userId && !user) {
        throw new BadRequestException("One or more employee recipients do not belong to tenant");
      }

      const email = (user?.email ?? recipient.email ?? "").trim().toLowerCase();

      if (!email) {
        throw new BadRequestException("Recipient email is required");
      }

      normalized.push({
        recipientType: user ? EmailRecipientType.EMPLOYEE : recipient.recipientType ?? EmailRecipientType.EXTERNAL,
        recipientKind: recipient.recipientKind,
        email,
        name: user?.name ?? recipient.name,
        userId: user?.id
      });
    }

    const deduped = new Map<string, NormalizedRecipient>();
    for (const recipient of normalized) {
      deduped.set(`${recipient.recipientKind}:${recipient.email}`, recipient);
    }

    if (![...deduped.values()].some((recipient) => recipient.recipientKind === EmailRecipientKind.TO)) {
      throw new BadRequestException("Email must have at least one TO recipient");
    }

    return [...deduped.values()];
  }

  private async resolveSubjectAndBody(
    companyId: string,
    templateId: string | null | undefined,
    subject: string | undefined,
    body: string | undefined,
    variables: Record<string, string | number | boolean | null> | undefined
  ) {
    const template = templateId
      ? await this.prisma.emailTemplate.findFirst({
          where: { id: templateId, companyId, deletedAt: null }
        })
      : null;

    if (templateId && !template) {
      throw new BadRequestException("Email template does not belong to tenant");
    }

    const resolvedSubject = this.renderTemplate(subject?.trim() || template?.subject || "", variables);
    const resolvedBody = this.renderTemplate(body?.trim() || template?.body || "", variables);

    if (!resolvedSubject || !resolvedBody) {
      throw new BadRequestException("Email subject and body are required");
    }

    return {
      subject: resolvedSubject,
      body: resolvedBody,
      templateId: template?.id
    };
  }

  private renderTemplate(value: string, variables: Record<string, string | number | boolean | null> | undefined) {
    if (!variables) {
      return value;
    }

    return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
      const replacement = variables[key];
      return replacement === undefined || replacement === null ? "" : String(replacement);
    });
  }

  private async replaceAttachments(companyId: string, actorId: string, emailId: string, attachments: EmailAttachmentDto[]) {
    await this.prisma.emailAttachment.updateMany({
      where: { companyId, emailId, deletedAt: null },
      data: { deletedAt: new Date() }
    });
    await this.prisma.attachment.updateMany({
      where: { companyId, entityType: EntityType.EMAIL, entityId: emailId, deletedAt: null },
      data: { deletedAt: new Date() }
    });

    for (const attachment of attachments) {
      await this.addAttachment(companyId, actorId, emailId, attachment);
    }
  }

  private toProviderMessage(companyId: string, email: Awaited<ReturnType<EmailsService["findOne"]>>): EmailProviderMessage {
    const recipients = email.recipients.filter((recipient) => !recipient.deletedAt);
    const byKind = (kind: EmailRecipientKind): EmailProviderAddress[] =>
      recipients
        .filter((recipient) => recipient.recipientKind === kind)
        .map((recipient) => ({
          email: recipient.email,
          name: recipient.name ?? undefined
        }));

    return {
      companyId,
      from: {
        email: email.fromEmail ?? "",
        name: email.fromName ?? undefined
      },
      replyTo: email.replyTo ? { email: email.replyTo } : undefined,
      to: byKind(EmailRecipientKind.TO),
      cc: byKind(EmailRecipientKind.CC),
      bcc: byKind(EmailRecipientKind.BCC),
      subject: email.subject,
      html: email.body,
      text: this.htmlToText(email.body),
      attachments: email.attachments
        .filter((link) => !link.deletedAt && !link.attachment.deletedAt)
        .map((link) => ({
          fileName: link.attachment.fileName,
          filePath: link.attachment.filePath,
          mimeType: link.attachment.mimeType,
          fileSize: link.attachment.fileSize
        }))
    };
  }

  private htmlToText(value: string) {
    return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  private publishEmailEvent(name: string, companyId: string, actorId: string | null, emailId: string, payload: Record<string, unknown>) {
    this.eventBus.publish({
      name,
      companyId,
      actorId,
      entityType: EntityType.EMAIL,
      entityId: emailId,
      payload
    });
  }

  private emailListInclude() {
    return {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      recipients: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" }
      },
      template: {
        select: {
          id: true,
          name: true
        }
      },
      _count: {
        select: {
          attachments: true
        }
      }
    } as const;
  }

  private emailDetailInclude() {
    return {
      ...this.emailListInclude(),
      attachments: {
        where: { deletedAt: null },
        include: {
          attachment: true
        },
        orderBy: { createdAt: "desc" }
      }
    } as const;
  }
}
