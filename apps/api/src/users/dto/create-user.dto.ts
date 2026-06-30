import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Locale, UserStatus } from "@prisma/client";
import { IsArray, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateUserDto {
  @ApiProperty({ example: "employee@company.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "محمد عبدالله الحربي" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ enum: Locale, default: Locale.AR })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;

  @ApiPropertyOptional({ enum: UserStatus, default: UserStatus.INVITED })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  roleIds?: string[];
}
