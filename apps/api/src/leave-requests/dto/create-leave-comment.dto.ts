import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateLeaveCommentDto {
  @ApiProperty({ example: "Please add handover details before approval." })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;
}
