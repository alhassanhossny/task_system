import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { PLATFORM_USAGE_SNAPSHOT_JOB_NAMES, QUEUE_NAMES } from "./queue.constants";

export interface PlatformUsageSnapshotQueuePayload {
  date?: string;
  actorId?: string;
  actorCompanyId?: string;
}

@Injectable()
export class PlatformUsageSnapshotQueue {
  constructor(@InjectQueue(QUEUE_NAMES.platformUsageSnapshot) private readonly usageSnapshotQueue: Queue<PlatformUsageSnapshotQueuePayload>) {}

  scheduleDailySnapshot(payload: PlatformUsageSnapshotQueuePayload = {}) {
    return this.usageSnapshotQueue.add(PLATFORM_USAGE_SNAPSHOT_JOB_NAMES.generateDaily, payload, {
      repeat: { pattern: "0 1 * * *" },
      removeOnComplete: 14,
      removeOnFail: 100
    });
  }

  enqueueSnapshot(payload: PlatformUsageSnapshotQueuePayload = {}) {
    return this.usageSnapshotQueue.add(PLATFORM_USAGE_SNAPSHOT_JOB_NAMES.generateDaily, payload, {
      removeOnComplete: 14,
      removeOnFail: 100
    });
  }
}
