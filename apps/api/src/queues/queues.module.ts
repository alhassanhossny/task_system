import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EmailQueue } from "./email.queue";
import { NotificationQueue } from "./notification.queue";
import { PlatformUsageSnapshotQueue } from "./platform-usage-snapshot.queue";
import { QUEUE_NAMES } from "./queue.constants";
import { SearchQueue } from "./search.queue";
import { TaskReminderQueue } from "./task-reminder.queue";

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>("REDIS_HOST", "localhost"),
          port: config.get<number>("REDIS_PORT", 6379),
          password: config.get<string>("REDIS_PASSWORD") || undefined,
          db: config.get<number>("REDIS_DB", 0)
        }
      })
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.email
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.notification
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.search
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.taskReminder
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.platformUsageSnapshot
    })
  ],
  providers: [EmailQueue, NotificationQueue, SearchQueue, TaskReminderQueue, PlatformUsageSnapshotQueue],
  exports: [BullModule, EmailQueue, NotificationQueue, SearchQueue, TaskReminderQueue, PlatformUsageSnapshotQueue]
})
export class QueuesModule {}
