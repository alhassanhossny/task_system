import { EmailStatus, EntityType, TaskStatus, UserStatus } from "@prisma/client";
import { Job, Queue } from "bullmq";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DomainEventBus } from "../../../domain-events/domain-event-bus.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { PlatformUsageSnapshotQueue, PlatformUsageSnapshotQueuePayload } from "../../../queues/platform-usage-snapshot.queue";
import { PLATFORM_USAGE_SNAPSHOT_JOB_NAMES } from "../../../queues/queue.constants";
import { PlatformUsageSnapshotWorker } from "../platform-usage-snapshot.worker";
import { PlatformUsageSnapshotsService } from "../platform-usage-snapshots.service";
import { PlatformService } from "../platform.service";

const prisma = new PrismaService();

type MockQueueCall = {
  schedulerId?: string;
  repeat?: unknown;
  template?: {
    name?: string;
    data?: PlatformUsageSnapshotQueuePayload;
    opts?: Record<string, unknown>;
  };
  name?: string;
  data?: PlatformUsageSnapshotQueuePayload;
  opts?: Record<string, unknown>;
};

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const eventBus = new DomainEventBus();
  const usageSnapshotsService = new PlatformUsageSnapshotsService(prisma, eventBus);
  const worker = new PlatformUsageSnapshotWorker(usageSnapshotsService);
  const platformService = new PlatformService(prisma, eventBus, { signAsync: async () => "switch-token" } as never);

  await assertQueueScheduling();
  await assertWorkerUnitBehavior();

  const company = await prisma.company.create({
    data: {
      name: `Worker Analytics ${suffix}`,
      slug: `worker-analytics-${suffix}`
    }
  });

  try {
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        email: `worker-analytics-${suffix}@example.com`,
        passwordHash: "test",
        name: "Worker Analytics User",
        status: UserStatus.ACTIVE
      }
    });

    await Promise.all([
      prisma.task.createMany({
        data: Array.from({ length: 25 }, (_, index) => ({
          companyId: company.id,
          createdById: user.id,
          taskNumber: `WORKER-${suffix}-${index + 1}`,
          title: `Worker Snapshot Task ${index + 1}`,
          status: TaskStatus.IN_PROGRESS
        }))
      }),
      prisma.email.createMany({
        data: Array.from({ length: 12 }, (_, index) => ({
          companyId: company.id,
          createdById: user.id,
          subject: `Worker Sent Email ${index + 1}`,
          body: "Worker body",
          status: EmailStatus.SENT,
          sentAt: new Date("2026-07-07T08:00:00.000Z")
        }))
      }),
      prisma.attachment.createMany({
        data: Array.from({ length: 10 }, (_, index) => ({
          companyId: company.id,
          entityType: EntityType.COMPANY,
          entityId: company.id,
          fileName: `worker-${index + 1}.pdf`,
          filePath: `/worker/${suffix}/worker-${index + 1}.pdf`,
          mimeType: "application/pdf",
          fileSize: 2048,
          uploadedById: user.id
        }))
      })
    ]);

    const result = await worker.process(
      job({
        id: `worker-job-${suffix}`,
        name: PLATFORM_USAGE_SNAPSHOT_JOB_NAMES.generateDaily,
        data: {
          date: "2026-07-07T09:00:00.000Z"
        }
      })
    );

    assert.ok(result);
    assert.ok(result.snapshotsCount > 0);

    const { periodStart, periodEnd } = usageSnapshotsService.dailyPeriod(new Date("2026-07-07T09:00:00.000Z"));
    const snapshot = await prisma.platformUsageSnapshot.findUniqueOrThrow({
      where: {
        companyId_periodStart_periodEnd: {
          companyId: company.id,
          periodStart,
          periodEnd
        }
      }
    });

    assert.equal(snapshot.usersCount, 1);
    assert.equal(snapshot.activeUsersCount, 1);
    assert.equal(snapshot.tasksCount, 25);
    assert.equal(snapshot.openTasksCount, 25);
    assert.equal(snapshot.emailsSentCount, 12);
    assert.equal(Number(snapshot.storageBytes), 20480);

    const usage = await platformService.getUsageMetrics({
      range: "7d",
      companyId: company.id,
      periodTo: "2026-07-07T09:00:00.000Z"
    });
    const usageDay = "2026-07-07";
    assert.equal(usage.companies.find((point) => point.date === usageDay)?.value, 1);
    assert.equal(usage.users.find((point) => point.date === usageDay)?.value, 1);
    assert.equal(usage.tasks.find((point) => point.date === usageDay)?.value, 25);
    assert.equal(usage.emails.find((point) => point.date === usageDay)?.value, 12);

    console.log("Platform usage snapshot worker assertions passed for scheduling, worker processing, retries, failures, and usage metric population.");
  } finally {
    await cleanup(company.id);
    await prisma.$disconnect();
  }
}

async function assertQueueScheduling() {
  const calls: MockQueueCall[] = [];
  const mockQueue = {
    upsertJobScheduler: async (schedulerId: string, repeat: unknown, template: MockQueueCall["template"]) => {
      calls.push({ schedulerId, repeat, template });
      return { id: schedulerId };
    },
    add: async (name: string, data: PlatformUsageSnapshotQueuePayload, opts: Record<string, unknown>) => {
      calls.push({ name, data, opts });
      return { id: opts.jobId ?? name };
    }
  } as unknown as Queue<PlatformUsageSnapshotQueuePayload>;
  const queue = new PlatformUsageSnapshotQueue(mockQueue);

  await queue.scheduleDailySnapshot();
  await queue.scheduleDailySnapshot();
  await queue.enqueueSnapshot({ date: "2026-07-07T00:00:00.000Z" });
  await queue.onApplicationBootstrap();

  const schedulerCalls = calls.filter((call) => call.schedulerId);
  assert.equal(schedulerCalls.length, 3);
  assert.ok(schedulerCalls.every((call) => call.schedulerId === "platform-usage-snapshot:daily"));
  assert.ok(schedulerCalls.every((call) => JSON.stringify(call.repeat).includes("0 1 * * *")));
  assert.ok(schedulerCalls.every((call) => call.template?.name === PLATFORM_USAGE_SNAPSHOT_JOB_NAMES.generateDaily));
  assert.ok(schedulerCalls.every((call) => call.template?.opts?.attempts === 3));
  assert.ok(schedulerCalls.every((call) => call.template?.opts?.removeOnComplete === 14));

  const enqueueCall = calls.find((call) => call.name === PLATFORM_USAGE_SNAPSHOT_JOB_NAMES.generateDaily);
  assert.ok(enqueueCall);
  assert.equal(enqueueCall.opts?.attempts, 3);
  assert.equal(enqueueCall.opts?.jobId, "platform-usage-snapshot:2026-07-07T00:00:00.000Z");

  const failingQueue = new PlatformUsageSnapshotQueue({
    upsertJobScheduler: async () => {
      throw new Error("redis unavailable");
    }
  } as unknown as Queue<PlatformUsageSnapshotQueuePayload>);
  await failingQueue.onApplicationBootstrap();
}

async function assertWorkerUnitBehavior() {
  const mockService = {
    generateDailySnapshot: async () => ({
      periodStart: new Date("2026-07-07T00:00:00.000Z"),
      periodEnd: new Date("2026-07-07T23:59:59.999Z"),
      snapshots: [{ id: "snapshot" }]
    })
  } as unknown as PlatformUsageSnapshotsService;
  const worker = new PlatformUsageSnapshotWorker(mockService);

  const ignored = await worker.process(job({ id: "unknown", name: "unknown-job", data: {} }));
  assert.equal(ignored, null);

  await assert.rejects(
    () =>
      worker.process(
        job({
          id: "invalid-date",
          name: PLATFORM_USAGE_SNAPSHOT_JOB_NAMES.generateDaily,
          data: { date: "not-a-date" }
        })
      ),
    /invalid date/
  );

  const failingWorker = new PlatformUsageSnapshotWorker({
    generateDailySnapshot: async () => {
      throw new Error("snapshot failure");
    }
  } as unknown as PlatformUsageSnapshotsService);
  await assert.rejects(
    () =>
      failingWorker.process(
        job({
          id: "failed",
          name: PLATFORM_USAGE_SNAPSHOT_JOB_NAMES.generateDaily,
          data: { date: "2026-07-07T00:00:00.000Z" }
        })
      ),
    /snapshot failure/
  );
  failingWorker.onFailed(undefined, new Error("snapshot failure"));
}

function job(input: { id: string; name: string; data: PlatformUsageSnapshotQueuePayload }) {
  return input as unknown as Job<PlatformUsageSnapshotQueuePayload>;
}

async function cleanup(companyId: string) {
  await prisma.platformUsageSnapshot.deleteMany({ where: { companyId } });
  await prisma.attachment.deleteMany({ where: { companyId } });
  await prisma.email.deleteMany({ where: { companyId } });
  await prisma.task.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
}

void main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
