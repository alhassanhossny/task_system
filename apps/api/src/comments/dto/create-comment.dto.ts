import { ApiProperty } from "@nestjs/swagger";
import { EntityType } from "@prisma/client";
import { IsEnum, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateCommentDto {
  @ApiProperty({ enum: EntityType })
  @IsEnum(EntityType)
  entityType!: EntityType;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  entityId!: string;

  @ApiProperty({ example: "Please review this before approval." })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;
}
