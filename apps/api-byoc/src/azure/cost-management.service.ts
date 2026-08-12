import { Injectable } from "@nestjs/common";
import { CostManagementClient, QueryResult } from "@azure/arm-costmanagement";
import { AccumulatedCost, DailyCost, ResourceCost, ServiceCost } from "@cloudguard/shared";
import { AzureCredentialProvider } from "./azure-credential.provider";
import { mockCostByResource, mockCostByService, mockDailyCosts } from "./mock-cost-data";

// USE_MOCK_COST_DATA=true skips Azure Cost Management entirely for the three
// dashboard-facing endpoints (daily, by-service, by-resource — accumulated
// derives from daily so it's covered for free) and returns deterministic
// canned data instead. Dev-only escape hatch from Azure's per-subscription
// throttle quota (see CLAUDE.md) while iterating on dashboard UI. /sync's
// queryLast30DaysCost is intentionally left real.
const useMockCostData = process.env.USE_MOCK_COST_DATA === "true";

// First-cut only: a single "cost by day, last 30 days" query per subscription.
// Deliberately does not persist line-item cost rows — that's the deferred
// TimescaleDB ingestion schema (see docs/byoc/connect-azure.md open items).
//
// Azure's Cost Management Query API has a tight built-in throttling quota
// (rolling window, roughly dozens of calls/hour per subscription) — an
// in-memory cache keeps repeated querying of the same subscription/range
// from burning through it. Default widened from 30 min to 4h per
// docs/byoc/plan/cost-management-429-resilience.md's Phase 1 step 2 — cost data
// already lags Azure-side by up to 24h, so a longer TTL costs nothing in
// freshness while meaningfully cutting 429 risk. Override with COST_CACHE_TTL_MINUTES.
const CACHE_TTL_MS = (Number(process.env.COST_CACHE_TTL_MINUTES) || 240) * 60 * 1000;

@Injectable()
export class CostManagementService {
  private readonly cache = new Map<string, { expiresAt: number; data: unknown }>();

  constructor(private readonly credentialProvider: AzureCredentialProvider) {}

  private async withCache<T>(key: string, fetcher: () => Promise<T>): Promise<{ data: T; cached: boolean }> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return { data: cached.data as T, cached: true };
    }
    const data = await fetcher();
    this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data });
    return { data, cached: false };
  }

  async queryLast30DaysCost(azureSubscriptionId: string): Promise<{ totalCost: number; currency: string }> {
    const { data } = await this.withCache(`sync:${azureSubscriptionId}`, async () => {
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
    });

    return data;
  }

  async queryDailyCosts(
    azureSubscriptionId: string,
    days: number,
  ): Promise<{ data: { currency: string; from: string; to: string; days: DailyCost[] }; cached: boolean }> {
    return this.withCache(`daily:${azureSubscriptionId}:${days}`, async () => {
      const { from, to, fromIso, toIso } = customDateRange(days);
      if (useMockCostData) {
        return mockDailyCosts(azureSubscriptionId, fromIso, toIso);
      }

      const client = new CostManagementClient(this.credentialProvider.get());
      const scope = `/subscriptions/${azureSubscriptionId}`;

      const result = await client.query.usage(scope, {
        type: "ActualCost",
        timeframe: "Custom",
        timePeriod: { from, to },
        dataset: {
          granularity: "Daily",
          aggregation: {
            totalCost: { name: "Cost", function: "Sum" },
          },
        },
      });

      const costIndex = findColumnIndex(result, "Cost");
      const dateIndex = findColumnIndex(result, "UsageDate");
      const currencyIndex = findColumnIndex(result, "Currency");
      const rows = result?.rows ?? [];

      const dailyCosts: DailyCost[] = rows.map((row) => ({
        date: formatUsageDate(row[dateIndex]),
        cost: Number(row[costIndex] ?? 0),
      }));

      const currency = (rows[0]?.[currencyIndex] as string) ?? "EUR";

      return { currency, from: fromIso, to: toIso, days: dailyCosts };
    });
  }

  // Derived from the (cached) daily costs — a running sum needs no Azure call
  // of its own, so this always inherits queryDailyCosts's cache status.
  async queryAccumulatedCosts(
    azureSubscriptionId: string,
    days: number,
  ): Promise<{ data: { currency: string; from: string; to: string; days: AccumulatedCost[] }; cached: boolean }> {
    const { data: daily, cached } = await this.queryDailyCosts(azureSubscriptionId, days);

    let runningTotal = 0;
    const accumulated: AccumulatedCost[] = daily.days.map((d) => {
      runningTotal += d.cost;
      return { date: d.date, cumulativeCost: runningTotal };
    });

    return { data: { currency: daily.currency, from: daily.from, to: daily.to, days: accumulated }, cached };
  }

  async queryCostByService(
    azureSubscriptionId: string,
    days: number,
  ): Promise<{ data: { currency: string; from: string; to: string; services: ServiceCost[] }; cached: boolean }> {
    return this.withCache(`byService:${azureSubscriptionId}:${days}`, async () => {
      const { from, to, fromIso, toIso } = customDateRange(days);
      if (useMockCostData) {
        return mockCostByService(azureSubscriptionId, fromIso, toIso);
      }

      const client = new CostManagementClient(this.credentialProvider.get());
      const scope = `/subscriptions/${azureSubscriptionId}`;

      const result = await client.query.usage(scope, {
        type: "ActualCost",
        timeframe: "Custom",
        timePeriod: { from, to },
        dataset: {
          granularity: "None",
          aggregation: {
            totalCost: { name: "Cost", function: "Sum" },
          },
          grouping: [{ type: "Dimension", name: "ServiceName" }],
        },
      });

      const costIndex = findColumnIndex(result, "Cost");
      const serviceNameIndex = findColumnIndex(result, "ServiceName");
      const currencyIndex = findColumnIndex(result, "Currency");
      const rows = result?.rows ?? [];

      const services: ServiceCost[] = rows
        .map((row) => ({
          serviceName: String(row[serviceNameIndex] ?? "Unknown"),
          cost: Number(row[costIndex] ?? 0),
        }))
        .sort((a, b) => b.cost - a.cost);

      const currency = (rows[0]?.[currencyIndex] as string) ?? "EUR";

      return { currency, from: fromIso, to: toIso, services };
    });
  }

  async queryCostByResource(
    azureSubscriptionId: string,
    days: number,
  ): Promise<{ data: { currency: string; from: string; to: string; resources: ResourceCost[] }; cached: boolean }> {
    return this.withCache(`byResource:${azureSubscriptionId}:${days}`, async () => {
      const { from, to, fromIso, toIso } = customDateRange(days);
      if (useMockCostData) {
        return mockCostByResource(azureSubscriptionId, fromIso, toIso);
      }

      const client = new CostManagementClient(this.credentialProvider.get());
      const scope = `/subscriptions/${azureSubscriptionId}`;

      const result = await client.query.usage(scope, {
        type: "ActualCost",
        timeframe: "Custom",
        timePeriod: { from, to },
        dataset: {
          granularity: "None",
          aggregation: {
            totalCost: { name: "Cost", function: "Sum" },
          },
          grouping: [{ type: "Dimension", name: "ResourceId" }],
        },
      });

      const costIndex = findColumnIndex(result, "Cost");
      const resourceIdIndex = findColumnIndex(result, "ResourceId");
      const currencyIndex = findColumnIndex(result, "Currency");
      const rows = result?.rows ?? [];

      const resources: ResourceCost[] = rows
        .map((row) => {
          const resourceId = String(row[resourceIdIndex] ?? "Unknown");
          return {
            resourceId,
            resourceName: resourceNameFromId(resourceId),
            cost: Number(row[costIndex] ?? 0),
          };
        })
        .sort((a, b) => b.cost - a.cost);

      const currency = (rows[0]?.[currencyIndex] as string) ?? "EUR";

      return { currency, from: fromIso, to: toIso, resources };
    });
  }
}

// Azure rejects a `to` that includes today's exact time-of-day as "in the
// future" (same-day cost data isn't fully processed yet) — normalize to
// UTC-midnight boundaries instead of the literal current instant. Azure's
// Custom timeframe is inclusive of both from and to, so asking for N days
// means going back (N - 1) days from today, not N.
function customDateRange(days: number): { from: Date; to: Date; fromIso: string; toIso: string } {
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from, to, fromIso: from.toISOString().slice(0, 10), toIso: to.toISOString().slice(0, 10) };
}

function findColumnIndex(result: QueryResult | undefined, name: string): number {
  const columns = result?.columns ?? [];
  return columns.findIndex((c) => c.name === name);
}

// Azure returns UsageDate as an integer like 20260804 — reformat to ISO (YYYY-MM-DD).
function formatUsageDate(value: unknown): string {
  const raw = String(value);
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

// ResourceId is a full ARM path like
// /subscriptions/.../resourceGroups/.../providers/.../storageAccounts/foo —
// the last path segment is the human-readable resource name.
function resourceNameFromId(resourceId: string): string {
  const segments = resourceId.split("/");
  return segments[segments.length - 1] || resourceId;
}
