import { EntityType, NotificationType, TaskPriority, TaskStatus, UserStatus } from "@prisma/client";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AttachmentsService } from "../../attachments/attachments.service";
import { CommentsService } from "../../comments/comments.service";
import { DomainEventBus } from "../../domain-events/domain-event-bus.service";
import { PrismaService } from "../../prisma/prisma.service";
import { SearchIndexer } from "../../search/search-indexer.service";
import { StorageProvider } from "../../storage/storage-provider";
import { TaskEventsHandler } from "../events/task-events.handler";
import { TasksService } from "../tasks.service";

const storage: StorageProvider = {
  normalizeKey: (key) => key.replace(/^\/+/, ""),
  getObjectUrl: async (key) => `local://${key}`
};

const prisma = new PrismaService();

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const eventBus = new DomainEventBus();
  const searchIndexer = new SearchIndexer(prisma);
  const commentsService = new CommentsService(prisma);
  const attachmentsService = new AttachmentsService(prisma, storage);
  const tasksService = new TasksService(prisma, eventBus, commentsService, attachmentsService);
  const taskEventsHandler = new TaskEventsHandler(eventBus, prisma, searchIndexer);

  taskEventsHandler.onModuleInit();

  const company = await prisma.company.create({
    data: {
      name: `Tasks Tenant ${suffix}`,
      slug: `tasks-tenant-${suffix}`
    }
  });

  try {
    const [creator, assignee, watcher] = await Promise.all([
      prisma.user.create({
        data: {
          companyId: company.id,
          email: `creator-${suffix}@example.com`,
          passwordHash: "test",
          name: "Task Creator",
          status: UserStatus.ACTIVE
        }
      }),
      prisma.user.create({
        data: {
          companyId: company.id,
          email: `assignee-${suffix}@example.com`,
          passwordHash: "test",
          name: "Task Assignee",
          status: UserStatus.ACTIVE
        }
      }),
      prisma.user.create({
        data: {
          companyId: company.id,
          email: `watcher-${suffix}@example.com`,
          passwordHash: "test",
          name: "Task Watcher",
          status: UserStatus.ACTIVE
        }
      })
    ]);

    const department = await prisma.department.create({
      data: {
        companyId: company.id,
        managerId: creator.id,
        name: "Operations",
        code: `OPS-${suffix}`
      }
    });

    const created = await tasksService.create(company.id, creator.id, {
      title: "Prepare task core regression",
      description: "Exercise task workflow and collaboration integrations.",
      departmentId: department.id,
      priority: TaskPriority.HIGH,
      assigneeIds: [assignee.id],
      watcherIds: [watcher.id],
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      estimatedHours: 4
    });

    assert.equal(created.taskNumber, "TASK-00001");
    assert.equal(created.status, TaskStatus.ASSIGNED);
    assert.equal(created.assignees.length, 1);
    assert.equal(created.watchers.length, 3, "creator, assignee, and watcher should watch the task");

    await waitFor(async () => {
      const searchEntry = await prisma.searchIndex.findFirst({
        where: { companyId: company.id, entityType: EntityType.TASK, entityId: created.id, deletedAt: null }
      });
      return Boolean(searchEntry?.content.includes("TASK-00001"));
    });

    await waitFor(async () => {
      const assignedNotification = await prisma.notification.findFirst({
        where: {
          companyId: company.id,
          userId: assignee.id,
          type: NotificationType.TASK_ASSIGNED,
          entityId: created.id
        }
      });
      return Boolean(assignedNotification);
    });

    const updated = await tasksService.update(company.id, creator.id, created.id, {
      title: "Prepare task core regression test",
      actualHours: 1.5
    });
    assert.equal(updated.title, "Prepare task core regression test");

    const reassigned = await tasksService.assign(company.id, creator.id, created.id, {
      assigneeIds: [assignee.id, watcher.id]
    });
    assert.equal(reassigned.assignees.length, 2);
    assert.equal(reassigned.watchers.length, 3, "Reassigning should keep existing watchers and add assignees");

    const comment = await tasksService.addComment(company.id, assignee.id, created.id, {
      content: "Regression comment"
    });
    assert.equal(comment.entityType, EntityType.TASK);

    const attachment = await tasksService.addAttachment(company.id, creator.id, created.id, {
      fileName: "brief.pdf",
      filePath: "/task-core/brief.pdf",
      mimeType: "application/pdf",
      fileSize: 1024
    });
    assert.equal(attachment.filePath, "task-core/brief.pdf");

    const inProgress = await tasksService.updateStatus(company.id, creator.id, created.id, {
      status: TaskStatus.IN_PROGRESS
    });
    assert.equal(inProgress.status, TaskStatus.IN_PROGRESS);

    const completed = await tasksService.updateStatus(company.id, creator.id, created.id, {
      status: TaskStatus.COMPLETED,
      actualHours: 2
    });
    assert.equal(completed.status, TaskStatus.COMPLETED);
    assert.ok(completed.completedAt);

    await waitFor(async () => {
      const count = await prisma.activity.count({
        where: {
          companyId: company.id,
          metadata: {
            path: ["taskId"],
            equals: created.id
          }
        }
      });
      return count >= 5;
    });

    await waitFor(async () => {
      const completedNotification = await prisma.notification.findFirst({
        where: {
          companyId: company.id,
          userId: assignee.id,
          type: NotificationType.TASK_COMPLETED,
          entityId: created.id
        }
      });
      return Boolean(completedNotification);
    });

    await tasksService.softDelete(company.id, creator.id, created.id);
    await waitFor(async () => {
      const searchEntry = await prisma.searchIndex.findFirst({
        where: { companyId: company.id, entityType: EntityType.TASK, entityId: created.id }
      });
      const activityCount = await prisma.activity.count({
        where: {
          companyId: company.id,
          metadata: {
            path: ["taskId"],
            equals: created.id
          }
        }
      });

      return Boolean(searchEntry?.deletedAt) && activityCount >= 9;
    });

    console.log("Task core assertions passed for workflow, collaboration, events, notifications, and search.");
  } finally {
    taskEventsHandler.onModuleDestroy();
    await cleanup(company.id);
    await prisma.$disconnect();
  }
}

async function waitFor(predicate: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error("Timed out waiting for async task event side effect");
}

async function cleanup(companyId: string) {
  await prisma.notification.deleteMany({ where: { companyId } });
  await prisma.searchIndex.deleteMany({ where: { companyId } });
  await prisma.auditLog.deleteMany({ where: { companyId } });
  await prisma.activity.deleteMany({ where: { companyId } });
  await prisma.attachment.deleteMany({ where: { companyId } });
  await prisma.comment.deleteMany({ where: { companyId } });
  await prisma.taskWatcher.deleteMany({ where: { companyId } });
  await prisma.taskAssignee.deleteMany({ where: { companyId } });
  await prisma.task.deleteMany({ where: { companyId } });
  await prisma.department.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.notification.deleteMany({ where: { companyId } });
  await prisma.searchIndex.deleteMany({ where: { companyId } });
  await prisma.auditLog.deleteMany({ where: { companyId } });
  await prisma.activity.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
}

void main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
