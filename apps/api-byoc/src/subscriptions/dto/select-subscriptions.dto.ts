import { ArrayMinSize, IsArray, IsString } from "class-validator";

export class SelectSubscriptionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  subscriptionIds!: string[];
}
