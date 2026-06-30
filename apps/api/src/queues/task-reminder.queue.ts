import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { QUEUE_NAMES, TASK_REMINDER_JOB_NAMES } from "./queue.constants";

export interface TaskReminderQueuePayload {
  companyId?: string;
}

@Injectable()
export class TaskReminderQueue {
  constructor(@InjectQueue(QUEUE_NAMES.taskReminder) private readonly taskReminderQueue: Queue<TaskReminderQueuePayload>) {}

  enqueueDueSoonScan(payload: TaskReminderQueuePayload = {}) {
    return this.taskReminderQueue.add(TASK_REMINDER_JOB_NAMES.scanDueSoon, payload, {
      repeat: { pattern: "0 * * * *" },
      removeOnComplete: 24,
      removeOnFail: 100
    });
  }

  enqueueOverdueScan(payload: TaskReminderQueuePayload = {}) {
    return this.taskReminderQueue.add(TASK_REMINDER_JOB_NAMES.scanOverdue, payload, {
      repeat: { pattern: "15 * * * *" },
      removeOnComplete: 24,
      removeOnFail: 100
    });
  }
}
