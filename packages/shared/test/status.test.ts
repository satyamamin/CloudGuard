import { describe, expect, it } from "vitest";
import { healthResponseSchema, instanceStatusSchema, syncResultSchema } from "../src";

describe("instanceStatusSchema", () => {
  const base = { state: "idle", lastSyncedAt: null, lastSyncError: null, selectedSubscriptionIds: [] };

  it("accepte les 3 états et des dates nulles", () => {
    for (const state of ["idle", "syncing", "failed"]) {
      expect(instanceStatusSchema.safeParse({ ...base, state }).success).toBe(true);
    }
  });

  it("refuse un état inconnu", () => {
    expect(instanceStatusSchema.safeParse({ ...base, state: "paused" }).success).toBe(false);
  });

  it("exige une date ISO (format toISOString du backend)", () => {
    expect(instanceStatusSchema.safeParse({ ...base, lastSyncedAt: new Date().toISOString() }).success).toBe(true);
    expect(instanceStatusSchema.safeParse({ ...base, lastSyncedAt: "hier" }).success).toBe(false);
  });
});

describe("syncResultSchema", () => {
  it("accepte un résultat valide", () => {
    const now = new Date().toISOString();
    expect(syncResultSchema.safeParse({ startedAt: now, finishedAt: now, subscriptionsSynced: 2 }).success).toBe(true);
  });

  it("refuse un nombre d'abonnements négatif ou décimal", () => {
    const now = new Date().toISOString();
    expect(syncResultSchema.safeParse({ startedAt: now, finishedAt: now, subscriptionsSynced: -1 }).success).toBe(false);
    expect(syncResultSchema.safeParse({ startedAt: now, finishedAt: now, subscriptionsSynced: 1.5 }).success).toBe(false);
  });
});

describe("healthResponseSchema", () => {
  it("n'accepte que status « ok »", () => {
    expect(healthResponseSchema.safeParse({ status: "ok", version: "0.1.0" }).success).toBe(true);
    expect(healthResponseSchema.safeParse({ status: "degraded", version: "0.1.0" }).success).toBe(false);
  });
});
