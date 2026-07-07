import { ApiPropertyOptional } from "@nestjs/swagger";
import { EntityType } from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";

export class SavedFilterQueryDto {
  @ApiPropertyOptional({ enum: EntityType })
  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;
}
