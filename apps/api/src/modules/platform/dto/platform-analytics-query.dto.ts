import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsUUID } from "class-validator";

export const PLATFORM_ANALYTICS_RANGES = ["7d", "30d", "90d", "365d"] as const;
export type PlatformAnalyticsRange = (typeof PLATFORM_ANALYTICS_RANGES)[number];

export class PlatformAnalyticsQueryDto {
  @ApiPropertyOptional({ enum: PLATFORM_ANALYTICS_RANGES, default: "30d" })
  @IsOptional()
  @IsIn(PLATFORM_ANALYTICS_RANGES)
  range?: PlatformAnalyticsRange;

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
