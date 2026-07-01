import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export const SEARCH_TYPES = ["ALL", "TASK", "USER", "LEAVE_REQUEST", "DEPARTMENT"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export class SearchQueryDto {
  @ApiPropertyOptional({ example: "Ahmed" })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: SEARCH_TYPES, default: "ALL" })
  @IsOptional()
  @IsIn(SEARCH_TYPES)
  type?: SearchType;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
