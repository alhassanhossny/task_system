import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsUUID } from "class-validator";

export class LeaveCalendarQueryDto {
  @ApiProperty({ example: "2026-07-01T00:00:00.000Z" })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: "2026-07-31T23:59:59.000Z" })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ enum: ["day", "week", "month"] })
  @IsOptional()
  @IsIn(["day", "week", "month"])
  groupBy?: "day" | "week" | "month";
}
