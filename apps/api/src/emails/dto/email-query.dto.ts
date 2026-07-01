import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { EmailStatus } from "@prisma/client";

export class EmailQueryDto {
  @IsEnum(EmailStatus)
  @IsOptional()
  status?: EmailStatus;

  @IsString()
  @IsOptional()
  search?: string;

  @IsDateString()
  @IsOptional()
  createdFrom?: string;

  @IsDateString()
  @IsOptional()
  createdTo?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 20;
}
