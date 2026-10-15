import { SyncService } from "./sync.service";

jest.mock("../instance/instance.service", () => ({ InstanceService: class {} }));
jest.mock("../azure/cost-management.service", () => ({ CostManagementService: class {} }));

function build(opts: { subs?: string[]; lastSyncError?: string | null; queryImpl?: jest.Mock } = {}) {
  const instance = {
    id: "inst-1",
    selectedSubscriptionIds: opts.subs ?? ["sub-1", "sub-2"],
    lastSyncedAt: null as Date | null,
    lastSyncError: opts.lastSyncError ?? null,
  };
  const instanceService = {
    getOrCreate: jest.fn().mockImplementation(async () => instance),
    update: jest.fn().mockImplementation(async (_id: string, data: object) => Object.assign(instance, data)),
  };
  const cost = {
    queryLast30DaysCost: opts.queryImpl ?? jest.fn().mockResolvedValue({ totalCost: 1, currency: "EUR" }),
  };
  return { service: new SyncService(instanceService as never, cost as never), instance, instanceService, cost };
}

describe("SyncService.triggerSync", () => {
  it("synchronise chaque abonnement sélectionné et enregistre lastSyncedAt", async () => {
    const { service, cost, instanceService } = build();

    const result = await service.triggerSync();

    expect(cost.queryLast30DaysCost).toHaveBeenCalledTimes(2);
    expect(cost.queryLast30DaysCost).toHaveBeenNthCalledWith(1, "sub-1");
    expect(cost.queryLast30DaysCost).toHaveBeenNthCalledWith(2, "sub-2");
    expect(result.subscriptionsSynced).toBe(2);
    expect(new Date(result.finishedAt).getTime()).toBeGreaterThanOrEqual(new Date(result.startedAt).getTime());
    expect(instanceService.update).toHaveBeenCalledWith(
      "inst-1",
      expect.objectContaining({ lastSyncedAt: expect.any(Date), lastSyncError: null }),
    );
  });

  it("enregistre lastSyncError puis relance l'erreur si Azure échoue", async () => {
    const { service, instanceService } = build({ queryImpl: jest.fn().mockRejectedValue(new Error("Azure KO")) });

    await expect(service.triggerSync()).rejects.toThrow("Azure KO");
    expect(instanceService.update).toHaveBeenCalledWith("inst-1", { lastSyncError: "Azure KO" });
  });

  it("libère le verrou après un échec (une nouvelle synchro reste possible)", async () => {
    const queryImpl = jest.fn().mockRejectedValueOnce(new Error("KO")).mockResolvedValue({ totalCost: 0, currency: "EUR" });
    const { service } = build({ queryImpl });

    await expect(service.triggerSync()).rejects.toThrow("KO");
    await expect(service.triggerSync()).resolves.toMatchObject({ subscriptionsSynced: 2 });
  });

  it("refuse une 2e synchro pendant qu'une première est en cours", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { service } = build({ queryImpl: jest.fn().mockImplementation(() => gate) });

    const first = service.triggerSync();
    await expect(service.triggerSync()).rejects.toThrow("already in progress");

    release();
    await expect(first).resolves.toBeDefined();
  });
});

describe("SyncService.getStatus", () => {
  it("idle quand rien n'a échoué", async () => {
    const { service } = build();
    await expect(service.getStatus()).resolves.toMatchObject({ state: "idle", lastSyncedAt: null });
  });

  it("failed quand la dernière synchro a échoué", async () => {
    const { service } = build({ lastSyncError: "boom" });
    await expect(service.getStatus()).resolves.toMatchObject({ state: "failed", lastSyncError: "boom" });
  });

  it("syncing pendant une synchro", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { service } = build({ queryImpl: jest.fn().mockImplementation(() => gate) });

    const running = service.triggerSync();
    await new Promise((r) => setImmediate(r));
    await expect(service.getStatus()).resolves.toMatchObject({ state: "syncing" });

    release();
    await running;
  });
});
