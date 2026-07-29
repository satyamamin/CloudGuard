import { z } from "zod";

export const azureSubscriptionSchema = z.object({
  azureSubscriptionId: z.string(),
  displayName: z.string(),
});
export type AzureSubscription = z.infer<typeof azureSubscriptionSchema>;

export const listSubscriptionsResponseSchema = z.array(azureSubscriptionSchema);
export type ListSubscriptionsResponse = z.infer<typeof listSubscriptionsResponseSchema>;

export const selectSubscriptionsRequestSchema = z.object({
  subscriptionIds: z.array(z.string()).min(1),
});
export type SelectSubscriptionsRequest = z.infer<typeof selectSubscriptionsRequestSchema>;
