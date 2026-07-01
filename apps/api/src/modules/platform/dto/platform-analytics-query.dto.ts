import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class PlatformAnalyticsQueryDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodTo?: string;
}
