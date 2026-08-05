import "server-only";
import {
  AccumulatedCostsResponse,
  CostByResourceResponse,
  CostByServiceResponse,
  DailyCostsResponse,
  HealthResponse,
  InstancePairing,
  InstanceStatus,
  ListSubscriptionsResponse,
  SyncResult,
  accumulatedCostsResponseSchema,
  costByResourceResponseSchema,
  costByServiceResponseSchema,
  dailyCostsResponseSchema,
  healthResponseSchema,
  instanceStatusSchema,
  listSubscriptionsResponseSchema,
  syncResultSchema,
} from "@cloudguard/shared";

export interface CostsQuery {
  subscriptionId?: string;
  days?: number;
}

function costsQueryString(query?: CostsQuery): string {
  const params = new URLSearchParams();
  if (query?.subscriptionId) params.set("subscriptionId", query.subscriptionId);
  if (query?.days) params.set("days", String(query.days));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// Thin fetch wrapper around the endpoints exposed by a customer's deployed
// backend instance — the 5 documented in docs/connect-azure.md, plus the 4
// undocumented /costs/* endpoints (see docs/azure-cost-management-endpoints.md).
// Every call here runs server-side (Route Handlers) so the API key never
// reaches the browser.
class BackendClient {
  constructor(
    private readonly backendUrl: string,
    private readonly apiKey: string,
  ) {}

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    const response = await fetch(`${this.backendUrl}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Backend request to ${path} failed with status ${response.status}`);
    }

    return response.json();
  }

  async health(): Promise<HealthResponse> {
    return healthResponseSchema.parse(await this.request("/health"));
  }

  async listSubscriptions(): Promise<ListSubscriptionsResponse> {
    return listSubscriptionsResponseSchema.parse(await this.request("/subscriptions"));
  }

  async selectSubscriptions(subscriptionIds: string[]): Promise<void> {
    await this.request("/subscriptions/select", {
      method: "POST",
      body: JSON.stringify({ subscriptionIds }),
    });
  }

  async status(): Promise<InstanceStatus> {
    return instanceStatusSchema.parse(await this.request("/status"));
  }

  async sync(): Promise<SyncResult> {
    return syncResultSchema.parse(await this.request("/sync", { method: "POST" }));
  }

  async dailyCosts(query?: CostsQuery): Promise<DailyCostsResponse> {
    return dailyCostsResponseSchema.parse(await this.request(`/costs/daily${costsQueryString(query)}`));
  }

  async accumulatedCosts(query?: CostsQuery): Promise<AccumulatedCostsResponse> {
    return accumulatedCostsResponseSchema.parse(await this.request(`/costs/accumulated${costsQueryString(query)}`));
  }

  async costByService(query?: CostsQuery): Promise<CostByServiceResponse> {
    return costByServiceResponseSchema.parse(await this.request(`/costs/by-service${costsQueryString(query)}`));
  }

  async costByResource(query?: CostsQuery): Promise<CostByResourceResponse> {
    return costByResourceResponseSchema.parse(await this.request(`/costs/by-resource${costsQueryString(query)}`));
  }
}

export function backendClientFor(pairing: InstancePairing): BackendClient {
  return new BackendClient(pairing.backendUrl, pairing.apiKey);
}
