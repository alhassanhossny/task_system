import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ApprovalWorkflowsService } from "./approval-workflows.service";

@Module({
  imports: [PrismaModule],
  providers: [ApprovalWorkflowsService],
  exports: [ApprovalWorkflowsService]
})
export class ApprovalWorkflowsModule {}
