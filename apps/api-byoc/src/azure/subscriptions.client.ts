import { Injectable } from "@nestjs/common";
import { SubscriptionClient } from "@azure/arm-subscriptions";
import { AzureSubscription } from "@finops-lab/shared";
import { AzureCredentialProvider } from "./azure-credential.provider";

// Not in the original Tech Stack SDK list (Cost Management / Resource Graph /
// Advisor / Monitor / Identity) — needed specifically to enumerate the
// subscriptions visible to this instance's identity for GET /subscriptions.
@Injectable()
export class SubscriptionsClient {
  constructor(private readonly credentialProvider: AzureCredentialProvider) {}

  async list(): Promise<AzureSubscription[]> {
    const client = new SubscriptionClient(this.credentialProvider.get());
    const subscriptions: AzureSubscription[] = [];

    for await (const sub of client.subscriptions.list()) {
      if (sub.subscriptionId && sub.displayName) {
        subscriptions.push({
          azureSubscriptionId: sub.subscriptionId,
          displayName: sub.displayName,
        });
      }
    }

    return subscriptions;
  }
}
