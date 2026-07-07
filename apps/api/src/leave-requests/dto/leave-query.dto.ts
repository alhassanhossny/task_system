import { ApiPropertyOptional } from "@nestjs/swagger";
import { LeaveRequestType, LeaveStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";

export class LeaveQueryDto {
  @ApiPropertyOptional({ enum: LeaveStatus })
  @IsOptional()
  @IsEnum(LeaveStatus)
  status?: LeaveStatus;

  @ApiPropertyOptional({ enum: LeaveRequestType })
  @IsOptional()
  @IsEnum(LeaveRequestType)
  requestType?: LeaveRequestType;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
