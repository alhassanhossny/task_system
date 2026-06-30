import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CreateLeaveAttachmentDto {
  @ApiProperty({ example: "medical-report.pdf" })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: "companies/acme/leaves/medical-report.pdf" })
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
}
