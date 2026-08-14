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
} from "@finops-lab/shared";

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
// backend instance — the 5 documented in docs/byoc/connect-azure.md, plus the 4
// undocumented /costs/* endpoints (see docs/byoc/azure-cost-management-endpoints.md).
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
      // NestJS's default error shape (and AzureQuotaExceededFilter's clean
      // 503) both send { statusCode, message } — surface that message when
      // present so callers like ErrorState show the real reason instead of
      // a bare status code.
      const body = await response.json().catch(() => null);
      const message = body && typeof body === "object" && "message" in body ? String(body.message) : undefined;
      throw new Error(message ?? `Backend request to ${path} failed with status ${response.status}`);
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
