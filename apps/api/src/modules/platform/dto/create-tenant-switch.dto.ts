import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsObject, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateTenantSwitchDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  companyId!: string;

  @ApiPropertyOptional({ example: "Support investigation" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: { ticketId: "SUP-1001" } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
