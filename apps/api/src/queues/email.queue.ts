import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { EMAIL_JOB_NAMES, QUEUE_NAMES } from "./queue.constants";

export interface EmailQueuePayload {
  companyId: string;
  emailMessageId: string;
  requestedById: string;
}

@Injectable()
export class EmailQueue {
  constructor(@InjectQueue(QUEUE_NAMES.email) private readonly emailQueue: Queue<EmailQueuePayload>) {}

  enqueueSendEmail(payload: EmailQueuePayload) {
    return this.emailQueue.add(EMAIL_JOB_NAMES.sendEmail, payload, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000
      },
      removeOnComplete: 100,
      removeOnFail: 500
    });
  }
}
