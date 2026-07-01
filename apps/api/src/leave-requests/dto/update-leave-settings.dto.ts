import { ApiProperty } from "@nestjs/swagger";
import { LeaveApprovalMode } from "@prisma/client";
import { IsEnum } from "class-validator";

export class UpdateLeaveSettingsDto {
  @ApiProperty({ enum: LeaveApprovalMode })
  @IsEnum(LeaveApprovalMode)
  approvalMode!: LeaveApprovalMode;
}
