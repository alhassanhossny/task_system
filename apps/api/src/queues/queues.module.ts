import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { QUEUE_NAMES } from "./queue.constants";
import { EmailQueueService } from "./email-queue.service";

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
    })
  ],
  providers: [EmailQueueService],
  exports: [BullModule, EmailQueueService]
})
export class QueuesModule {}
