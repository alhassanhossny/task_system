import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class TeamAvailabilityQueryDto {
  @ApiPropertyOptional({ example: "2026-07-01T00:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  referenceDate?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;
}
