import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Queue } from "bullmq";
import { PLATFORM_USAGE_SNAPSHOT_JOB_NAMES, QUEUE_NAMES } from "./queue.constants";

export interface PlatformUsageSnapshotQueuePayload {
  date?: string;
  actorId?: string;
  actorCompanyId?: string;
}

@Injectable()
export class PlatformUsageSnapshotQueue implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlatformUsageSnapshotQueue.name);
  private readonly dailySchedulerId = "platform-usage-snapshot:daily";
  private readonly dailyCronPattern = "0 1 * * *";

  constructor(@InjectQueue(QUEUE_NAMES.platformUsageSnapshot) private readonly usageSnapshotQueue: Queue<PlatformUsageSnapshotQueuePayload>) {}

  async onApplicationBootstrap() {
    try {
      await this.scheduleDailySnapshot();
      this.logger.log(`Scheduled platform usage snapshot job with cron "${this.dailyCronPattern}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to schedule platform usage snapshot job: ${message}`, error instanceof Error ? error.stack : undefined);
    }
  }

  scheduleDailySnapshot(payload: PlatformUsageSnapshotQueuePayload = {}) {
    return this.usageSnapshotQueue.upsertJobScheduler(
      this.dailySchedulerId,
      { pattern: this.dailyCronPattern },
      {
        name: PLATFORM_USAGE_SNAPSHOT_JOB_NAMES.generateDaily,
        data: payload,
        opts: this.jobOptions()
      }
    );
  }

  enqueueSnapshot(payload: PlatformUsageSnapshotQueuePayload = {}) {
    return this.usageSnapshotQueue.add(PLATFORM_USAGE_SNAPSHOT_JOB_NAMES.generateDaily, payload, {
      ...this.jobOptions(),
      jobId: payload.date ? `platform-usage-snapshot:${payload.date}` : undefined
    });
  }

  private jobOptions() {
    return {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000
      },
      removeOnComplete: 14,
      removeOnFail: 100
    } as const;
  }
}
