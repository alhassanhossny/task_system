import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { NOTIFICATION_JOB_NAMES, QUEUE_NAMES } from "./queue.constants";

export interface NotificationQueuePayload {
  companyId: string;
  userId: string;
  notificationId?: string;
}

@Injectable()
export class NotificationQueue {
  constructor(@InjectQueue(QUEUE_NAMES.notification) private readonly notificationQueue: Queue<NotificationQueuePayload>) {}

  enqueuePublishNotification(payload: NotificationQueuePayload) {
    return this.notificationQueue.add(NOTIFICATION_JOB_NAMES.publishNotification, payload, {
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
