import { z } from "zod";

export const dailyCostSchema = z.object({
  date: z.string(),
  cost: z.number(),
});
export type DailyCost = z.infer<typeof dailyCostSchema>;

export const dailyCostsResponseSchema = z.object({
  currency: z.string(),
  from: z.string(),
  to: z.string(),
  days: z.array(dailyCostSchema),
});
export type DailyCostsResponse = z.infer<typeof dailyCostsResponseSchema>;

export const serviceCostSchema = z.object({
  serviceName: z.string(),
  cost: z.number(),
});
export type ServiceCost = z.infer<typeof serviceCostSchema>;

export const costByServiceResponseSchema = z.object({
  currency: z.string(),
  from: z.string(),
  to: z.string(),
  services: z.array(serviceCostSchema),
});
export type CostByServiceResponse = z.infer<typeof costByServiceResponseSchema>;

export const resourceCostSchema = z.object({
  resourceId: z.string(),
  resourceName: z.string(),
  cost: z.number(),
});
export type ResourceCost = z.infer<typeof resourceCostSchema>;

export const costByResourceResponseSchema = z.object({
  currency: z.string(),
  from: z.string(),
  to: z.string(),
  resources: z.array(resourceCostSchema),
});
export type CostByResourceResponse = z.infer<typeof costByResourceResponseSchema>;

export const accumulatedCostSchema = z.object({
  date: z.string(),
  cumulativeCost: z.number(),
});
export type AccumulatedCost = z.infer<typeof accumulatedCostSchema>;

export const accumulatedCostsResponseSchema = z.object({
  currency: z.string(),
  from: z.string(),
  to: z.string(),
  days: z.array(accumulatedCostSchema),
});
export type AccumulatedCostsResponse = z.infer<typeof accumulatedCostsResponseSchema>;
