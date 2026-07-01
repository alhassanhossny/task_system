import { ApiPropertyOptional } from "@nestjs/swagger";
import { BillingInterval, SubscriptionStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsUUID, Min } from "class-validator";

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  planId?: string;

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
  currentPeriodEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  cancelledAt?: string;

  @ApiPropertyOptional({ example: { note: "updated by platform admin" } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
