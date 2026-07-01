import { ApiPropertyOptional } from "@nestjs/swagger";
import { LeaveDurationType, LeaveHalfDayPeriod } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class UpdateLeaveRequestDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ enum: LeaveDurationType })
  @IsOptional()
  @IsEnum(LeaveDurationType)
  durationType?: LeaveDurationType;

  @ApiPropertyOptional({ enum: LeaveHalfDayPeriod })
  @IsOptional()
  @IsEnum(LeaveHalfDayPeriod)
  halfDayPeriod?: LeaveHalfDayPeriod | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(8)
  durationHours?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string | null;
}
