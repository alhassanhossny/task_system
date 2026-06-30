import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateTaskCommentDto {
  @ApiProperty({ example: "Please review this before the end of the day." })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;
}
