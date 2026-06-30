import { ApiProperty } from "@nestjs/swagger";
import { EntityType } from "@prisma/client";
import { IsEnum, IsUUID } from "class-validator";

export class EntityReferenceDto {
  @ApiProperty({ enum: EntityType })
  @IsEnum(EntityType)
  entityType!: EntityType;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  entityId!: string;
}
