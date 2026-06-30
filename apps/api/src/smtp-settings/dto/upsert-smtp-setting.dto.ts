import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SmtpEncryption } from "@prisma/client";
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class UpsertSmtpSettingDto {
  @ApiProperty({ example: "smtp.example.com" })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  host!: string;

  @ApiProperty({ example: 587 })
  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @ApiPropertyOptional({ example: "smtp-user" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  @ApiPropertyOptional({ minLength: 1 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  password?: string;

  @ApiProperty({ enum: SmtpEncryption, default: SmtpEncryption.STARTTLS })
  @IsEnum(SmtpEncryption)
  encryption!: SmtpEncryption;

  @ApiProperty({ example: "TASK Flow" })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fromName!: string;

  @ApiProperty({ example: "noreply@example.com" })
  @IsEmail()
  fromEmail!: string;
}
