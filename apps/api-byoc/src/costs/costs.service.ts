import { BadRequestException, Injectable } from "@nestjs/common";
import { isRestError, RestError } from "@azure/core-rest-pipeline";
import {
  AccumulatedCostsResponse,
  CostByResourceResponse,
  CostByServiceResponse,
  DailyCostsResponse,
} from "@finops-lab/shared";
import { CostManagementService } from "../azure/cost-management.service";
import { InstanceService } from "../instance/instance.service";
import { AzureQuotaExceededException } from "../common/exceptions/azure-quota-exceeded.exception";

@Injectable()
export class CostsService {
  constructor(
    private readonly costManagementService: CostManagementService,
    private readonly instanceService: InstanceService,
  ) {}

  async getDailyCosts(
    subscriptionId: string | undefined,
    days: number,
  ): Promise<{ data: DailyCostsResponse; cached: boolean }> {
    const resolvedSubscriptionId = subscriptionId ?? (await this.defaultSubscriptionId());
    return this.runQuotaGuarded(
      resolvedSubscriptionId,
      "/costs/daily",
      () => this.costManagementService.queryDailyCosts(resolvedSubscriptionId, days),
    );
  }

  async getAccumulatedCosts(
    subscriptionId: string | undefined,
    days: number,
  ): Promise<{ data: AccumulatedCostsResponse; cached: boolean }> {
    const resolvedSubscriptionId = subscriptionId ?? (await this.defaultSubscriptionId());
    return this.runQuotaGuarded(
      resolvedSubscriptionId,
      "/costs/accumulated",
      () => this.costManagementService.queryAccumulatedCosts(resolvedSubscriptionId, days),
    );
  }

  async getCostByService(
    subscriptionId: string | undefined,
    days: number,
  ): Promise<{ data: CostByServiceResponse; cached: boolean }> {
    const resolvedSubscriptionId = subscriptionId ?? (await this.defaultSubscriptionId());
    return this.runQuotaGuarded(
      resolvedSubscriptionId,
      "/costs/by-service",
      () => this.costManagementService.queryCostByService(resolvedSubscriptionId, days),
    );
  }

  async getCostByResource(
    subscriptionId: string | undefined,
    days: number,
  ): Promise<{ data: CostByResourceResponse; cached: boolean }> {
    const resolvedSubscriptionId = subscriptionId ?? (await this.defaultSubscriptionId());
    return this.runQuotaGuarded(
      resolvedSubscriptionId,
      "/costs/by-resource",
      () => this.costManagementService.queryCostByResource(resolvedSubscriptionId, days),
    );
  }

  // Azure Cost Management throttling is scoped per subscription being
  // queried, not per caller -- a 429 here is expected/recurring, not a rare
  // edge case. Anything that isn't a 429 RestError rethrows unchanged.
  private async runQuotaGuarded<T>(
    azureSubscriptionId: string,
    endpoint: string,
    run: () => Promise<T>,
  ): Promise<T> {
    try {
      return await run();
    } catch (err) {
      if (isRestError(err) && err.statusCode === 429) {
        throw new AzureQuotaExceededException(azureSubscriptionId, endpoint, retryAfterSecondsFrom(err));
      }
      throw err;
    }
  }

  private async defaultSubscriptionId(): Promise<string> {
    const instance = await this.instanceService.getOrCreate();
    const [first] = instance.selectedSubscriptionIds;
    if (!first) {
      throw new BadRequestException("No subscription selected yet, and no subscriptionId was provided");
    }
    return first;
  }
}

// Azure's Cost Management 429 can come from any of four separate throttling
// layers (QPU, per-scope, per-tenant, per-ClientType), each with its own
// *-retry-after header -- reading only the QPU one meant the more common
// per-scope throttle logged "unknown" even though Azure told us exactly how
// long to wait. Take the max of whichever headers are actually present.
const RETRY_AFTER_HEADERS = [
  "x-ms-ratelimit-microsoft.costmanagement-qpu-retry-after",
  "x-ms-ratelimit-microsoft.costmanagement-entity-retry-after",
  "x-ms-ratelimit-microsoft.costmanagement-tenant-retry-after",
  "x-ms-ratelimit-microsoft.costmanagement-client-retry-after",
];

function retryAfterSecondsFrom(err: RestError): number | undefined {
  const values = RETRY_AFTER_HEADERS.map((name) => Number(err.response?.headers.get(name))).filter((n) =>
    Number.isFinite(n),
  );
  return values.length > 0 ? Math.max(...values) : undefined;
}
