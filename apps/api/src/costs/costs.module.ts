import { Module } from "@nestjs/common";
import { CostsController } from "./costs.controller";
import { CostsService } from "./costs.service";
import { AzureModule } from "../azure/azure.module";
import { InstanceModule } from "../instance/instance.module";

@Module({
  imports: [AzureModule, InstanceModule],
  controllers: [CostsController],
  providers: [CostsService],
})
export class CostsModule {}
