import { Controller, Get, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import {
  AccumulatedCostsResponse,
  CostByResourceResponse,
  CostByServiceResponse,
  DailyCostsResponse,
} from "@finops-lab/shared";
import { CostsService } from "./costs.service";
import { CostsQueryDto } from "./dto/costs-query.dto";

// How many days of history a /costs/* call returns when the caller doesn't
// pass ?days= explicitly.
const DEFAULT_COST_DAYS = Number(process.env.DEFAULT_COST_DAYS) || 30;

@Controller("costs")
export class CostsController {
  constructor(private readonly costsService: CostsService) {}

  @Get("daily")
  async daily(
    @Query() query: CostsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DailyCostsResponse> {
    const { data, cached } = await this.costsService.getDailyCosts(query.subscriptionId, query.days ?? DEFAULT_COST_DAYS);
    res.setHeader("X-Cache", cached ? "HIT" : "MISS");
    return data;
  }

  @Get("accumulated")
  async accumulated(
    @Query() query: CostsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccumulatedCostsResponse> {
    const { data, cached } = await this.costsService.getAccumulatedCosts(query.subscriptionId, query.days ?? DEFAULT_COST_DAYS);
    res.setHeader("X-Cache", cached ? "HIT" : "MISS");
    return data;
  }

  @Get("by-service")
  async byService(
    @Query() query: CostsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CostByServiceResponse> {
    const { data, cached } = await this.costsService.getCostByService(query.subscriptionId, query.days ?? DEFAULT_COST_DAYS);
    res.setHeader("X-Cache", cached ? "HIT" : "MISS");
    return data;
  }

  @Get("by-resource")
  async byResource(
    @Query() query: CostsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CostByResourceResponse> {
    const { data, cached } = await this.costsService.getCostByResource(query.subscriptionId, query.days ?? DEFAULT_COST_DAYS);
    res.setHeader("X-Cache", cached ? "HIT" : "MISS");
    return data;
  }
}
