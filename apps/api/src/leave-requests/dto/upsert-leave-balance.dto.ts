import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from "class-validator";

export class UpsertLeaveBalanceDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  employeeId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  leaveTypeId!: string;

  @ApiProperty({ minimum: 2020, maximum: 2100 })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;

  @ApiProperty({ minimum: 0, example: 21 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  allocatedDays!: number;

  @ApiPropertyOptional({ minimum: 0, example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  usedDays?: number;
}
