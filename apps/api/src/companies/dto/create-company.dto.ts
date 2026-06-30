import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CompanyPlan, CompanyStatus, Locale } from "@prisma/client";
import { IsEnum, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateCompanyDto {
  @ApiProperty({ example: "شركة التقنية المتقدمة" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: "advanced-tech" })
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @ApiPropertyOptional({ enum: CompanyPlan, default: CompanyPlan.STARTER })
  @IsOptional()
  @IsEnum(CompanyPlan)
  plan?: CompanyPlan;

  @ApiPropertyOptional({ enum: CompanyStatus, default: CompanyStatus.TRIAL })
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @ApiPropertyOptional({ enum: Locale, default: Locale.AR })
  @IsOptional()
  @IsEnum(Locale)
  defaultLocale?: Locale;
}
