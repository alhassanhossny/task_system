import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { EntityType } from "@prisma/client";
import { Queue } from "bullmq";
import { QUEUE_NAMES, SEARCH_JOB_NAMES } from "./queue.constants";

export interface SearchQueuePayload {
  companyId: string;
  entityType: EntityType;
  entityId: string;
}

@Injectable()
export class SearchQueue {
  constructor(@InjectQueue(QUEUE_NAMES.search) private readonly searchQueue: Queue<SearchQueuePayload>) {}

  enqueueIndex(payload: SearchQueuePayload) {
    return this.searchQueue.add(SEARCH_JOB_NAMES.indexEntity, payload, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 3000
      },
      removeOnComplete: 100,
      removeOnFail: 500
    });
  }
}
