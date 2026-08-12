import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { AzureSubscription } from "@cloudguard/shared";
import { SubscriptionsService } from "./subscriptions.service";
import { SelectSubscriptionsDto } from "./dto/select-subscriptions.dto";

@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  async list(): Promise<AzureSubscription[]> {
    return this.subscriptionsService.listDiscoverable();
  }

  @Post("select")
  @HttpCode(200)
  async select(@Body() dto: SelectSubscriptionsDto): Promise<{ ok: true }> {
    await this.subscriptionsService.select(dto.subscriptionIds);
    return { ok: true };
  }
}
