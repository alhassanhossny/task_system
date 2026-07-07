import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateEmailTemplateDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsString()
  @MaxLength(240)
  subject!: string;

  @IsString()
  body!: string;

  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;
}
