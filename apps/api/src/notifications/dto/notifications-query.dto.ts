import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBooleanString, IsOptional, IsString } from "class-validator";

export class NotificationsQueryDto {
  @ApiPropertyOptional({ example: "true" })
  @IsOptional()
  @IsBooleanString()
  unreadOnly?: string;

  @ApiPropertyOptional({ example: "20" })
  @IsOptional()
  @IsString()
  limit?: string;
}
