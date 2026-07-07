import { ApiProperty } from "@nestjs/swagger";
import { EntityType } from "@prisma/client";
import { IsEnum, IsObject, IsString, MinLength } from "class-validator";

export class CreateSavedFilterDto {
  @ApiProperty({ example: "My Open Tasks" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ enum: EntityType, example: EntityType.TASK })
  @IsEnum(EntityType)
  entityType!: EntityType;

  @ApiProperty({ example: { status: "IN_PROGRESS", assignedToId: "me" } })
  @IsObject()
  filterJson!: Record<string, unknown>;
}
