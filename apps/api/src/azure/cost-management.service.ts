import { Injectable } from "@nestjs/common";
import { CostManagementClient } from "@azure/arm-costmanagement";
import { AzureCredentialProvider } from "./azure-credential.provider";

// First-cut only: a single "cost by day, last 30 days" query per subscription.
// Deliberately does not persist line-item cost rows — that's the deferred
// TimescaleDB ingestion schema (see docs/connect-azure.md open items).
@Injectable()
export class CostManagementService {
  constructor(private readonly credentialProvider: AzureCredentialProvider) {}

  async queryLast30DaysCost(azureSubscriptionId: string): Promise<{ totalCost: number; currency: string }> {
    const client = new CostManagementClient(this.credentialProvider.get());
    const scope = `/subscriptions/${azureSubscriptionId}`;

    const result = await client.query.usage(scope, {
      type: "ActualCost",
      timeframe: "MonthToDate",
      dataset: {
        granularity: "Daily",
        aggregation: {
          totalCost: { name: "Cost", function: "Sum" },
        },
      },
    });

    const rows = result?.rows ?? [];
    const totalCost = rows.reduce((sum: number, row) => sum + Number(row[0] ?? 0), 0);
    const currency = (rows[0]?.[rows[0].length - 1] as string) ?? "EUR";

    return { totalCost, currency };
  }
}
