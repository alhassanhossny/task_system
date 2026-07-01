import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsObject, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";
import { EmailAttachmentDto } from "./email-attachment.dto";
import { EmailRecipientDto } from "./email-recipient.dto";

export class CreateEmailDto {
  @IsString()
  @MaxLength(240)
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsObject()
  @IsOptional()
  variables?: Record<string, string | number | boolean | null>;

  @IsUUID()
  @IsOptional()
  templateId?: string;

  @IsString()
  @MaxLength(254)
  @IsOptional()
  replyTo?: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EmailRecipientDto)
  recipients!: EmailRecipientDto[];

  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => EmailAttachmentDto)
  @IsOptional()
  attachments?: EmailAttachmentDto[];
}
