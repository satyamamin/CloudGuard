import { Injectable } from "@nestjs/common";
import { AzureSubscription } from "@finops-lab/shared";
import { InstanceService } from "../instance/instance.service";
import { SubscriptionsClient } from "../azure/subscriptions.client";

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly subscriptionsClient: SubscriptionsClient,
    private readonly instanceService: InstanceService,
  ) {}

  async listDiscoverable(): Promise<AzureSubscription[]> {
    return this.subscriptionsClient.list();
  }

  async select(subscriptionIds: string[]): Promise<void> {
    const instance = await this.instanceService.getOrCreate();
    await this.instanceService.update(instance.id, {
      selectedSubscriptionIds: subscriptionIds,
    });
  }
}
