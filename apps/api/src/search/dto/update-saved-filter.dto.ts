import { ApiPropertyOptional } from "@nestjs/swagger";
import { EntityType } from "@prisma/client";
import { IsEnum, IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateSavedFilterDto {
  @ApiPropertyOptional({ example: "My Open Tasks" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ enum: EntityType, example: EntityType.TASK })
  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  @ApiPropertyOptional({ example: { status: "IN_PROGRESS", assignedToId: "me" } })
  @IsOptional()
  @IsObject()
  filterJson?: Record<string, unknown>;
}
