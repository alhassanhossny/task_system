import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "admin@company.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Password123!" })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ description: "Optional tenant selection for users with duplicate email across tenants" })
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
