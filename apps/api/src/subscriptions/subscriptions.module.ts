import { Module } from "@nestjs/common";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";
import { AzureModule } from "../azure/azure.module";
import { InstanceModule } from "../instance/instance.module";

@Module({
  imports: [AzureModule, InstanceModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
})
export class SubscriptionsModule {}
