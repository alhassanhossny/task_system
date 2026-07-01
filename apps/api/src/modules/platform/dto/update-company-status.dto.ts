import { ApiPropertyOptional } from "@nestjs/swagger";
import { CompanyStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateCompanyStatusDto {
  @ApiPropertyOptional({ enum: CompanyStatus })
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @ApiPropertyOptional({ example: "Billing issue" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
