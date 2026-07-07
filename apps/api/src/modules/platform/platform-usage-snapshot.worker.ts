import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PlatformUsageSnapshotQueuePayload } from "../../queues/platform-usage-snapshot.queue";
import { PLATFORM_USAGE_SNAPSHOT_JOB_NAMES, QUEUE_NAMES } from "../../queues/queue.constants";
import { PlatformUsageSnapshotsService } from "./platform-usage-snapshots.service";

@Processor(QUEUE_NAMES.platformUsageSnapshot)
export class PlatformUsageSnapshotWorker extends WorkerHost {
  private readonly logger = new Logger(PlatformUsageSnapshotWorker.name);

  constructor(private readonly usageSnapshotsService: PlatformUsageSnapshotsService) {
    super();
  }

  async process(job: Job<PlatformUsageSnapshotQueuePayload>) {
    if (job.name !== PLATFORM_USAGE_SNAPSHOT_JOB_NAMES.generateDaily) {
      this.logger.warn(`Ignoring unknown platform usage snapshot job "${job.name}"`);
      return null;
    }

    const date = this.parseDate(job.data.date);
    this.logger.log(`Processing platform usage snapshot job ${job.id ?? "unknown"} for ${date.toISOString().slice(0, 10)}`);

    const result = await this.usageSnapshotsService.generateDailySnapshot({
      date,
      actorId: job.data.actorId,
      actorCompanyId: job.data.actorCompanyId
    });

    this.logger.log(`Generated ${result.snapshots.length} platform usage snapshots for ${result.periodStart.toISOString().slice(0, 10)}`);

    return {
      periodStart: result.periodStart.toISOString(),
      periodEnd: result.periodEnd.toISOString(),
      snapshotsCount: result.snapshots.length
    };
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<PlatformUsageSnapshotQueuePayload>) {
    this.logger.log(`Completed platform usage snapshot job ${job.id ?? "unknown"}`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<PlatformUsageSnapshotQueuePayload> | undefined, error: Error) {
    this.logger.error(
      `Platform usage snapshot job ${job?.id ?? "unknown"} failed after ${job?.attemptsMade ?? 0} attempts: ${error.message}`,
      error.stack
    );
  }

  private parseDate(value: string | undefined) {
    if (!value) {
      return new Date();
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Platform usage snapshot job received an invalid date");
    }

    return date;
  }
}
