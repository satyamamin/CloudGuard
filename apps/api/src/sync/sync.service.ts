import { Injectable } from "@nestjs/common";
import { InstanceStatus, SyncResult } from "@cloudguard/shared";
import { InstanceService } from "../instance/instance.service";
import { CostManagementService } from "../azure/cost-management.service";

@Injectable()
export class SyncService {
  // In-memory re-entrancy lock: correct because the Container App is pinned
  // to minReplicas=maxReplicas=1 for v1 (see infra/bicep) — a single process
  // is the only thing that can ever be running /sync at a time.
  private syncing = false;

  constructor(
    private readonly instanceService: InstanceService,
    private readonly costManagementService: CostManagementService,
  ) {}

  async getStatus(): Promise<InstanceStatus> {
    const instance = await this.instanceService.getOrCreate();
    return {
      state: this.syncing ? "syncing" : instance.lastSyncError ? "failed" : "idle",
      lastSyncedAt: instance.lastSyncedAt?.toISOString() ?? null,
      lastSyncError: instance.lastSyncError,
      selectedSubscriptionIds: instance.selectedSubscriptionIds,
    };
  }

  async triggerSync(): Promise<SyncResult> {
    if (this.syncing) {
      throw new Error("A sync is already in progress");
    }

    this.syncing = true;
    const startedAt = new Date();

    try {
      const instance = await this.instanceService.getOrCreate();

      // First-cut only: pull a single cost summary per selected subscription.
      // Persisting granular cost rows is deferred (TimescaleDB ingestion,
      // see docs/connect-azure.md open items) — this just proves the
      // Managed Identity → Cost Management path end to end.
      for (const azureSubscriptionId of instance.selectedSubscriptionIds) {
        await this.costManagementService.queryLast30DaysCost(azureSubscriptionId);
      }

      const finishedAt = new Date();
      await this.instanceService.update(instance.id, {
        lastSyncedAt: finishedAt,
        lastSyncError: null,
      });

      return {
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        subscriptionsSynced: instance.selectedSubscriptionIds.length,
      };
    } catch (error) {
      const instance = await this.instanceService.getOrCreate();
      await this.instanceService.update(instance.id, {
        lastSyncError: error instanceof Error ? error.message : "Unknown sync error",
      });
      throw error;
    } finally {
      this.syncing = false;
    }
  }
}
