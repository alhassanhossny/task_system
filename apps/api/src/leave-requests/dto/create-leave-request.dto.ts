import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { LeaveDurationType, LeaveHalfDayPeriod } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class CreateLeaveRequestDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  leaveTypeId!: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiProperty({ example: "2026-07-10T00:00:00.000Z" })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ example: "2026-07-12T23:59:59.000Z" })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ enum: LeaveDurationType, default: LeaveDurationType.FULL_DAY })
  @IsOptional()
  @IsEnum(LeaveDurationType)
  durationType?: LeaveDurationType;

  @ApiPropertyOptional({ enum: LeaveHalfDayPeriod })
  @IsOptional()
  @IsEnum(LeaveHalfDayPeriod)
  halfDayPeriod?: LeaveHalfDayPeriod;

  @ApiPropertyOptional({ minimum: 1, maximum: 8, example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(8)
  durationHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
