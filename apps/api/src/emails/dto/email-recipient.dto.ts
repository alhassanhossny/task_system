import { EmailRecipientKind, EmailRecipientType } from "@prisma/client";
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class EmailRecipientDto {
  @IsEnum(EmailRecipientKind)
  recipientKind!: EmailRecipientKind;

  @IsEnum(EmailRecipientType)
  @IsOptional()
  recipientType?: EmailRecipientType;

  @IsUUID()
  @IsOptional()
  userId?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MaxLength(160)
  @IsOptional()
  name?: string;
}
