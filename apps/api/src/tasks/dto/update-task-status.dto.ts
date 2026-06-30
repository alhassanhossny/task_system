import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TaskStatus } from "@prisma/client";
import { IsEnum, IsNumber, IsOptional, Max, Min } from "class-validator";

export class UpdateTaskStatusDto {
  @ApiProperty({ enum: TaskStatus })
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999)
  actualHours?: number;
}
