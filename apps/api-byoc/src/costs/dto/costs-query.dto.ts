import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CostsQueryDto {
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  // Capped at a year: Azure Cost Management deducts 1 QPU per month of data
  // queried (60 QPU/min budget), and the UI's widest preset is 90 days —
  // this only bounds worst-case abuse/bugs, not legitimate traffic.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(366)
  days?: number;
}
