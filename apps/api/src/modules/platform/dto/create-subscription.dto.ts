import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BillingInterval, SubscriptionStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsUUID, Min } from "class-validator";

export class CreateSubscriptionDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  companyId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  planId!: string;

  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ enum: BillingInterval })
  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  seats?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  trialEndsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  currentPeriodEnd?: string;

  @ApiPropertyOptional({ example: { source: "platform" } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
