import { Module } from "@nestjs/common";
import { ApprovalWorkflowsModule } from "../approval-workflows/approval-workflows.module";
import { AttachmentsModule } from "../attachments/attachments.module";
import { CommentsModule } from "../comments/comments.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SearchModule } from "../search/search.module";
import { LeaveEventsHandler } from "./events/leave-events.handler";
import { LeaveRequestsController } from "./leave-requests.controller";
import { LeaveRequestsService } from "./leave-requests.service";

@Module({
  imports: [PrismaModule, ApprovalWorkflowsModule, CommentsModule, AttachmentsModule, SearchModule],
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsService, LeaveEventsHandler],
  exports: [LeaveRequestsService]
})
export class LeaveRequestsModule {}
