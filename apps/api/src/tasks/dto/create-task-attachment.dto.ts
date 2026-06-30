import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from "class-validator";

export class CreateTaskAttachmentDto {
  @ApiProperty({ example: "requirements.pdf" })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: "companies/acme/tasks/TASK-00001/requirements.pdf" })
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
