import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, Length, MaxLength, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CompanyPlan } from "@prisma/client";

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: "business" })
  @IsString()
  @MaxLength(80)
  code!: string;

  @ApiProperty({ example: "Business" })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ enum: CompanyPlan })
  @IsOptional()
  @IsEnum(CompanyPlan)
  tier?: CompanyPlan;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyPrice?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  yearlyPrice?: number;

  @ApiPropertyOptional({ example: "USD" })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUsers?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxStorageMb?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxCompanies?: number;

  @ApiPropertyOptional({ example: { emailCenter: true, advancedReports: false } })
  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
