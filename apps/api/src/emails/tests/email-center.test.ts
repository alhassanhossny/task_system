import { EmailProvider } from "../../email-providers/email-provider";
import { EmailRecipientKind, EmailStatus, EntityType, NotificationType, SmtpEncryption, UserStatus } from "@prisma/client";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AttachmentsService } from "../../attachments/attachments.service";
import { PERMISSIONS } from "../../common/constants";
import { DomainEventBus } from "../../domain-events/domain-event-bus.service";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailQueue, EmailQueuePayload } from "../../queues/email.queue";
import { SearchIndexer } from "../../search/search-indexer.service";
import { SearchService } from "../../search/search.service";
import { StorageProvider } from "../../storage/storage-provider";
import { EmailTemplatesService } from "../email-templates.service";
import { EmailEventsHandler } from "../events/email-events.handler";
import { EmailsService } from "../emails.service";

const storage: StorageProvider = {
  normalizeKey: (key) => key.replace(/^\/+/, ""),
  getObjectUrl: async (key) => `local://${key}`
};

const prisma = new PrismaService();

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const eventBus = new DomainEventBus();
  const searchIndexer = new SearchIndexer(prisma);
  const queuedJobs: EmailQueuePayload[] = [];
  const queue = {
    enqueueSendEmail: async (payload: EmailQueuePayload) => {
      queuedJobs.push(payload);
      return { id: `job-${queuedJobs.length}` };
    }
  } as unknown as EmailQueue;
  const providerState = { failNext: false, sentSubjects: [] as string[] };
  const provider: EmailProvider = {
    async send(message) {
      providerState.sentSubjects.push(message.subject);

      if (providerState.failNext) {
        providerState.failNext = false;
        throw new Error("Temporary SMTP failure");
      }

      return {
        provider: "smtp:test",
        externalId: `smtp-${providerState.sentSubjects.length}`,
        accepted: message.to.map((recipient) => recipient.email),
        rejected: []
      };
    }
  };
  const attachmentsService = new AttachmentsService(prisma, storage);
  const emailsService = new EmailsService(prisma, eventBus, attachmentsService, queue, provider);
  const templatesService = new EmailTemplatesService(prisma);
  const eventsHandler = new EmailEventsHandler(eventBus, prisma, searchIndexer);
  const searchService = new SearchService(prisma);

  eventsHandler.onModuleInit();

  const [companyA, companyB] = await Promise.all([
    prisma.company.create({ data: { name: `Email A ${suffix}`, slug: `email-a-${suffix}` } }),
    prisma.company.create({ data: { name: `Email B ${suffix}`, slug: `email-b-${suffix}` } })
  ]);

  try {
    const [sender, employee, otherTenantUser] = await Promise.all([
      createUser(companyA.id, `sender-${suffix}@example.com`, "Sender User"),
      createUser(companyA.id, `employee-${suffix}@example.com`, "Employee Recipient"),
      createUser(companyB.id, `other-${suffix}@example.com`, "Other Tenant")
    ]);

    await prisma.smtpSetting.create({
      data: {
        companyId: companyA.id,
        host: "smtp.test.local",
        port: 25,
        encryption: SmtpEncryption.NONE,
        fromName: "TASK Flow",
        fromEmail: `no-reply-${suffix}@example.com`
      }
    });

    const template = await templatesService.create(companyA.id, sender.id, {
      name: `Welcome ${suffix}`,
      subject: "Welcome {{employee_name}}",
      body: "Hello {{employee_name}} from {{company_name}}"
    });

    const customTemplate = await templatesService.create(companyA.id, sender.id, {
      name: `Custom ${suffix}`,
      subject: "Custom subject",
      body: "Custom body"
    });
    await templatesService.update(companyA.id, customTemplate.id, { subject: "Updated custom subject" });
    await templatesService.remove(companyA.id, customTemplate.id);
    const templatesAfterDelete = await templatesService.findAll(companyA.id);
    assert.ok(!templatesAfterDelete.some((item) => item.id === customTemplate.id));

    await assert.rejects(
      () =>
        emailsService.create(companyA.id, sender.id, {
          templateId: template.id,
          variables: { employee_name: "Ahmed", company_name: "TASK Flow" },
          recipients: [{ recipientKind: EmailRecipientKind.TO, userId: otherTenantUser.id }]
        }),
      /tenant/
    );

    const created = await emailsService.create(companyA.id, sender.id, {
      templateId: template.id,
      variables: { employee_name: "Ahmed", company_name: "TASK Flow" },
      recipients: [
        { recipientKind: EmailRecipientKind.TO, userId: employee.id },
        { recipientKind: EmailRecipientKind.TO, email: employee.email },
        { recipientKind: EmailRecipientKind.CC, email: `client-${suffix}@example.com`, name: "Client Contact" }
      ],
      attachments: [
        {
          fileName: "proposal.pdf",
          filePath: "/emails/proposal.pdf",
          mimeType: "application/pdf",
          fileSize: 2048
        }
      ]
    });

    assert.equal(created.subject, "Welcome Ahmed");
    assert.equal(created.body, "Hello Ahmed from TASK Flow");
    assert.equal(created.status, EmailStatus.DRAFT);
    assert.equal(created.recipients.filter((recipient) => recipient.recipientKind === EmailRecipientKind.TO).length, 1, "duplicate TO addresses should be removed");
    assert.equal(created.attachments?.length, 1);

    await waitFor(async () => Boolean(await prisma.searchIndex.findFirst({ where: { companyId: companyA.id, entityType: EntityType.EMAIL, entityId: created.id } })));

    const noPermissionResults = await searchService.search(
      companyA.id,
      { id: sender.id, companyId: companyA.id, email: sender.email, roles: [], permissions: [PERMISSIONS.searchRead] },
      { q: "Ahmed", type: "EMAIL" }
    );
    assert.equal(noPermissionResults.results.length, 0);

    const searchResults = await searchService.search(
      companyA.id,
      { id: sender.id, companyId: companyA.id, email: sender.email, roles: [], permissions: [PERMISSIONS.searchRead, PERMISSIONS.emailsRead] },
      { q: "Ahmed", type: "EMAIL" }
    );
    assert.ok(searchResults.results.some((result) => result.id === created.id));

    await assert.rejects(() => emailsService.findOne(companyB.id, created.id), /not found/i);

    const queued = await emailsService.queue(companyA.id, sender.id, created.id);
    assert.equal(queued.status, EmailStatus.QUEUED);
    assert.equal(queuedJobs.length, 1);

    const sent = await emailsService.processQueuedEmail(companyA.id, created.id, sender.id);
    assert.equal(sent.status, EmailStatus.SENT);
    assert.equal(providerState.sentSubjects.at(-1), "Welcome Ahmed");

    await waitFor(async () => {
      const notification = await prisma.notification.findFirst({
        where: { companyId: companyA.id, userId: sender.id, type: NotificationType.EMAIL_SENT, entityId: created.id }
      });
      const index = await prisma.searchIndex.findFirst({
        where: { companyId: companyA.id, entityType: EntityType.EMAIL, entityId: created.id, deletedAt: null }
      });
      return Boolean(notification && index?.content.includes("SENT"));
    });

    const failing = await emailsService.create(companyA.id, sender.id, {
      subject: "Retry me",
      body: "Retry body",
      recipients: [{ recipientKind: EmailRecipientKind.TO, email: `retry-${suffix}@example.com` }]
    });
    await emailsService.queue(companyA.id, sender.id, failing.id);
    providerState.failNext = true;
    await assert.rejects(() => emailsService.processQueuedEmail(companyA.id, failing.id, sender.id), /Temporary SMTP failure/);
    const failed = await emailsService.findOne(companyA.id, failing.id);
    assert.equal(failed.status, EmailStatus.FAILED);
    assert.equal(failed.failureReason, "Temporary SMTP failure");

    const retried = await emailsService.retry(companyA.id, sender.id, failing.id);
    assert.equal(retried.status, EmailStatus.QUEUED);
    const sentAfterRetry = await emailsService.processQueuedEmail(companyA.id, failing.id, sender.id);
    assert.equal(sentAfterRetry.status, EmailStatus.SENT);

    const draftForCancel = await emailsService.create(companyA.id, sender.id, {
      subject: "Cancel me",
      body: "Cancel body",
      recipients: [{ recipientKind: EmailRecipientKind.TO, email: `cancel-${suffix}@example.com` }]
    });
    const cancelled = await emailsService.cancel(companyA.id, sender.id, draftForCancel.id);
    assert.equal(cancelled.status, EmailStatus.CANCELLED);
    await assert.rejects(() => emailsService.queue(companyA.id, sender.id, cancelled.id), /Invalid email status transition/);

    console.log("Email center assertions passed for creation, templates, queue processing, SMTP provider integration, retries, tenant isolation, search indexing, permissions, and status transitions.");
  } finally {
    eventsHandler.onModuleDestroy();
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

async function waitFor(predicate: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error("Timed out waiting for async email event side effect");
}

async function cleanup(companyId: string) {
  await prisma.recentSearch.deleteMany({ where: { companyId } });
  await prisma.searchIndex.deleteMany({ where: { companyId } });
  await prisma.notification.deleteMany({ where: { companyId } });
  await prisma.auditLog.deleteMany({ where: { companyId } });
  await prisma.activity.deleteMany({ where: { companyId } });
  await prisma.emailAttachment.deleteMany({ where: { companyId } });
  await prisma.attachment.deleteMany({ where: { companyId } });
  await prisma.emailRecipient.deleteMany({ where: { companyId } });
  await prisma.email.deleteMany({ where: { companyId } });
  await prisma.emailTemplate.deleteMany({ where: { companyId } });
  await prisma.smtpSetting.deleteMany({ where: { companyId } });
  await prisma.searchIndex.deleteMany({ where: { companyId } });
  await prisma.notification.deleteMany({ where: { companyId } });
  await prisma.auditLog.deleteMany({ where: { companyId } });
  await prisma.activity.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
}

void main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
