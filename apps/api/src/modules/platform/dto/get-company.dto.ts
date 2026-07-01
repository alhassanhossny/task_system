import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class GetCompanyDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  id!: string;
}
