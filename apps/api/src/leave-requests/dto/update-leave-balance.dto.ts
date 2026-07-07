import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsOptional, Min } from "class-validator";

export class UpdateLeaveBalanceDto {
  @ApiPropertyOptional({ minimum: 0, example: 21 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  allocatedDays?: number;

  @ApiPropertyOptional({ minimum: 0, example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  usedDays?: number;
}
