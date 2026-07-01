import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateEmailTemplateDto {
  @IsString()
  @MaxLength(160)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(240)
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;
}
