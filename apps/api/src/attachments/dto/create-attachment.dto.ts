import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { EntityType } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from "class-validator";

export class CreateAttachmentDto {
  @ApiProperty({ enum: EntityType })
  @IsEnum(EntityType)
  entityType!: EntityType;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  entityId!: string;

  @ApiProperty({ example: "contract.pdf" })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: "companies/acme/tasks/contract.pdf" })
  @IsString()
  @MinLength(1)
  filePath!: string;

  @ApiProperty({ example: "application/pdf" })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  mimeType!: string;

  @ApiProperty({ example: 120394 })
  @IsInt()
  @Min(1)
  fileSize!: number;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  uploadedById?: string;
}
