import { IsInt, IsMimeType, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class EmailAttachmentDto {
  @IsString()
  @MaxLength(240)
  fileName!: string;

  @IsString()
  @MaxLength(600)
  filePath!: string;

  @IsMimeType()
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024)
  fileSize!: number;

  @IsString()
  @IsOptional()
  uploadedById?: string;
}
