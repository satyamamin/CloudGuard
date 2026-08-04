import { BadRequestException, Injectable } from "@nestjs/common";
import {
  AccumulatedCostsResponse,
  CostByResourceResponse,
  CostByServiceResponse,
  DailyCostsResponse,
} from "@cloudguard/shared";
import { CostManagementService } from "../azure/cost-management.service";
import { InstanceService } from "../instance/instance.service";

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
    return this.costManagementService.queryDailyCosts(resolvedSubscriptionId, days);
  }

  async getAccumulatedCosts(
    subscriptionId: string | undefined,
    days: number,
  ): Promise<{ data: AccumulatedCostsResponse; cached: boolean }> {
    const resolvedSubscriptionId = subscriptionId ?? (await this.defaultSubscriptionId());
    return this.costManagementService.queryAccumulatedCosts(resolvedSubscriptionId, days);
  }

  async getCostByService(
    subscriptionId: string | undefined,
    days: number,
  ): Promise<{ data: CostByServiceResponse; cached: boolean }> {
    const resolvedSubscriptionId = subscriptionId ?? (await this.defaultSubscriptionId());
    return this.costManagementService.queryCostByService(resolvedSubscriptionId, days);
  }

  async getCostByResource(
    subscriptionId: string | undefined,
    days: number,
  ): Promise<{ data: CostByResourceResponse; cached: boolean }> {
    const resolvedSubscriptionId = subscriptionId ?? (await this.defaultSubscriptionId());
    return this.costManagementService.queryCostByResource(resolvedSubscriptionId, days);
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
