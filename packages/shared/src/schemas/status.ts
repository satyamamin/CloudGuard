import { z } from "zod";

export const syncStateSchema = z.enum(["idle", "syncing", "failed"]);
export type SyncState = z.infer<typeof syncStateSchema>;

export const instanceStatusSchema = z.object({
  state: syncStateSchema,
  lastSyncedAt: z.string().datetime().nullable(),
  lastSyncError: z.string().nullable(),
  selectedSubscriptionIds: z.array(z.string()),
});
export type InstanceStatus = z.infer<typeof instanceStatusSchema>;

export const syncResultSchema = z.object({
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  subscriptionsSynced: z.number().int().nonnegative(),
});
export type SyncResult = z.infer<typeof syncResultSchema>;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  version: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
