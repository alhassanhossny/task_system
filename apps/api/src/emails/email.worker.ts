import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { EmailQueuePayload } from "../queues/email.queue";
import { EMAIL_JOB_NAMES, QUEUE_NAMES } from "../queues/queue.constants";
import { EmailsService } from "./emails.service";

@Processor(QUEUE_NAMES.email)
export class EmailWorker extends WorkerHost {
  private readonly logger = new Logger(EmailWorker.name);

  constructor(private readonly emailsService: EmailsService) {
    super();
  }

  async process(job: Job<EmailQueuePayload>) {
    if (job.name !== EMAIL_JOB_NAMES.sendEmail) {
      return null;
    }

    this.logger.log(`Processing email job ${job.id} for email ${job.data.emailMessageId}`);

    return this.emailsService.processQueuedEmail(job.data.companyId, job.data.emailMessageId, job.data.requestedById);
  }
}
