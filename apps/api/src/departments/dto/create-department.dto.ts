import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, Matches, MinLength } from "class-validator";

export class CreateDepartmentDto {
  @ApiProperty({ example: "الموارد البشرية" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: "HR" })
  @IsString()
  @Matches(/^[A-Z0-9_-]+$/)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
