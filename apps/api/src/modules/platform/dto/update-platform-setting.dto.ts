import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PlatformSettingValueType } from "@prisma/client";
import { IsBoolean, IsDefined, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdatePlatformSettingDto {
  @ApiProperty({ example: "TASKFLOW" })
  @IsDefined()
  value!: unknown;

  @ApiPropertyOptional({ enum: PlatformSettingValueType })
  @IsOptional()
  @IsEnum(PlatformSettingValueType)
  valueType?: PlatformSettingValueType;

  @ApiPropertyOptional({ example: "Controls a platform-wide option." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;
}
