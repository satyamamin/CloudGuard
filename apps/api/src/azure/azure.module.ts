import { Module } from "@nestjs/common";
import { AzureCredentialProvider } from "./azure-credential.provider";
import { SubscriptionsClient } from "./subscriptions.client";
import { CostManagementService } from "./cost-management.service";

@Module({
  providers: [AzureCredentialProvider, SubscriptionsClient, CostManagementService],
  exports: [AzureCredentialProvider, SubscriptionsClient, CostManagementService],
})
export class AzureModule {}
