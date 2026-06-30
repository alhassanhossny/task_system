import { Module } from "@nestjs/common";
import { AttachmentsModule } from "../attachments/attachments.module";
import { CommentsModule } from "../comments/comments.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SearchModule } from "../search/search.module";
import { TaskEventsHandler } from "./events/task-events.handler";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
  imports: [PrismaModule, CommentsModule, AttachmentsModule, SearchModule],
  controllers: [TasksController],
  providers: [TasksService, TaskEventsHandler],
  exports: [TasksService]
})
export class TasksModule {}
