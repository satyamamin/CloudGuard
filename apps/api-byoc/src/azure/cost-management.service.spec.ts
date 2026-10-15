// Teste le parsing des réponses Azure Cost Management SANS appeler Azure :
// le SDK est remplacé par un mock qui renvoie des QueryResult réalistes.
const mockUsage = jest.fn();

jest.mock("@azure/arm-costmanagement", () => ({
  CostManagementClient: jest.fn().mockImplementation(() => ({ query: { usage: mockUsage } })),
}));
jest.mock("@azure/identity", () => ({
  AzureCliCredential: class {},
  DefaultAzureCredential: class {},
}));

type Env = { USE_MOCK_COST_DATA?: string; COST_CACHE_TTL_MINUTES?: string };

// Les constantes (cache TTL, mode mock) sont lues à l'import du module :
// on le recharge à chaque test pour repartir d'un cache vide.
function load(env: Env = {}) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  let service!: import("./cost-management.service").CostManagementService;
  jest.isolateModules(() => {
    const { CostManagementService } = require("./cost-management.service");
    service = new CostManagementService({ get: () => ({}) } as never);
  });
  process.env = saved;
  return service;
}

const result = (columns: string[], rows: unknown[][]) => ({ columns: columns.map((name) => ({ name })), rows });

beforeEach(() => mockUsage.mockReset());

describe("CostManagementService.queryDailyCosts", () => {
  it("parse les lignes (date entière → ISO, coût numérique, devise)", async () => {
    mockUsage.mockResolvedValue(
      result(["Cost", "UsageDate", "Currency"], [
        [12.5, 20260801, "EUR"],
        ["3.25", 20260802, "EUR"],
      ]),
    );
    const { data, cached } = await load().queryDailyCosts("sub-1", 2);

    expect(cached).toBe(false);
    expect(data.currency).toBe("EUR");
    expect(data.days).toEqual([
      { date: "2026-08-01", cost: 12.5 },
      { date: "2026-08-02", cost: 3.25 },
    ]);
  });

  it("ne dépend pas de l'ordre des colonnes renvoyé par Azure", async () => {
    mockUsage.mockResolvedValue(
      result(["Currency", "UsageDate", "Cost"], [["USD", 20260801, 7]]),
    );
    const { data } = await load().queryDailyCosts("sub-1", 1);
    expect(data.currency).toBe("USD");
    expect(data.days).toEqual([{ date: "2026-08-01", cost: 7 }]);
  });

  it("renvoie une liste vide et la devise par défaut (EUR) si Azure ne renvoie aucune ligne", async () => {
    mockUsage.mockResolvedValue(result(["Cost", "UsageDate", "Currency"], []));
    const { data } = await load().queryDailyCosts("sub-1", 30);
    expect(data.days).toEqual([]);
    expect(data.currency).toBe("EUR");
  });

  it("interroge le bon scope avec ActualCost / Daily et l'en-tête ClientType", async () => {
    mockUsage.mockResolvedValue(result(["Cost", "UsageDate", "Currency"], []));
    await load().queryDailyCosts("sub-xyz", 30);

    const [scope, body, options] = mockUsage.mock.calls[0];
    expect(scope).toBe("/subscriptions/sub-xyz");
    expect(body).toMatchObject({ type: "ActualCost", timeframe: "Custom", dataset: { granularity: "Daily" } });
    expect(options.requestOptions.headers.ClientType).toBe("FinOpsLab-CostReporting");
  });

  it("fenêtre de N jours inclusive : from = to − (N−1), bornes à minuit UTC", async () => {
    mockUsage.mockResolvedValue(result(["Cost", "UsageDate", "Currency"], []));
    const { data } = await load().queryDailyCosts("sub-1", 7);

    const from = new Date(`${data.from}T00:00:00Z`).getTime();
    const to = new Date(`${data.to}T00:00:00Z`).getTime();
    expect((to - from) / 86_400_000).toBe(6);
  });

  it("sert la 2e requête identique depuis le cache (un seul appel Azure)", async () => {
    mockUsage.mockResolvedValue(result(["Cost", "UsageDate", "Currency"], [[1, 20260801, "EUR"]]));
    const service = load();

    const first = await service.queryDailyCosts("sub-1", 30);
    const second = await service.queryDailyCosts("sub-1", 30);

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(mockUsage).toHaveBeenCalledTimes(1);
  });

  it("le cache est séparé par abonnement et par nombre de jours", async () => {
    mockUsage.mockResolvedValue(result(["Cost", "UsageDate", "Currency"], []));
    const service = load();

    await service.queryDailyCosts("sub-1", 30);
    await service.queryDailyCosts("sub-2", 30);
    await service.queryDailyCosts("sub-1", 7);

    expect(mockUsage).toHaveBeenCalledTimes(3);
  });

  it("ne met pas en cache une erreur Azure", async () => {
    mockUsage.mockRejectedValueOnce(new Error("429")).mockResolvedValue(result(["Cost", "UsageDate", "Currency"], []));
    const service = load();

    await expect(service.queryDailyCosts("sub-1", 30)).rejects.toThrow("429");
    await expect(service.queryDailyCosts("sub-1", 30)).resolves.toMatchObject({ cached: false });
    expect(mockUsage).toHaveBeenCalledTimes(2);
  });
});

describe("CostManagementService.queryAccumulatedCosts", () => {
  it("calcule le cumul sans appel Azure supplémentaire", async () => {
    mockUsage.mockResolvedValue(
      result(["Cost", "UsageDate", "Currency"], [
        [10, 20260801, "EUR"],
        [5, 20260802, "EUR"],
        [2.5, 20260803, "EUR"],
      ]),
    );
    const service = load();

    const { data } = await service.queryAccumulatedCosts("sub-1", 3);
    expect(data.days.map((d) => d.cumulativeCost)).toEqual([10, 15, 17.5]);

    const again = await service.queryAccumulatedCosts("sub-1", 3);
    expect(again.cached).toBe(true);
    expect(mockUsage).toHaveBeenCalledTimes(1);
  });
});

describe("CostManagementService.queryCostByService", () => {
  it("trie par coût décroissant et nomme « Unknown » un service sans nom", async () => {
    mockUsage.mockResolvedValue(
      result(["Cost", "ServiceName", "Currency"], [
        [5, "Storage", "EUR"],
        [50, "Virtual Machines", "EUR"],
        [1, null, "EUR"],
      ]),
    );
    const { data } = await load().queryCostByService("sub-1", 30);

    expect(data.services).toEqual([
      { serviceName: "Virtual Machines", cost: 50 },
      { serviceName: "Storage", cost: 5 },
      { serviceName: "Unknown", cost: 1 },
    ]);
    expect(mockUsage.mock.calls[0][1].dataset.grouping).toEqual([{ type: "Dimension", name: "ServiceName" }]);
  });
});

describe("CostManagementService.queryCostByResource", () => {
  it("extrait le nom de la ressource depuis l'ID ARM et trie par coût", async () => {
    const base = "/subscriptions/s/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts";
    mockUsage.mockResolvedValue(
      result(["Cost", "ResourceId", "Currency"], [
        [2, `${base}/small`, "EUR"],
        [9, `${base}/big`, "EUR"],
        [0.1, "", "EUR"],
      ]),
    );
    const { data } = await load().queryCostByResource("sub-1", 30);

    expect(data.resources.map((r) => r.resourceName)).toEqual(["big", "small", ""]);
    expect(data.resources[0]).toEqual({ resourceId: `${base}/big`, resourceName: "big", cost: 9 });
  });
});

describe("CostManagementService.queryLast30DaysCost (sync)", () => {
  it("additionne les lignes et lit la devise sur la dernière colonne", async () => {
    mockUsage.mockResolvedValue({ columns: [], rows: [[10, 20260801, "EUR"], [4.5, 20260802, "EUR"]] });
    const total = await load().queryLast30DaysCost("sub-1");
    expect(total).toEqual({ totalCost: 14.5, currency: "EUR" });
  });
});

describe("USE_MOCK_COST_DATA=true", () => {
  it("n'appelle jamais Azure pour daily / by-service / by-resource", async () => {
    const service = load({ USE_MOCK_COST_DATA: "true" });

    const daily = await service.queryDailyCosts("sub-1", 5);
    const services = await service.queryCostByService("sub-1", 5);
    const resources = await service.queryCostByResource("sub-1", 5);

    expect(daily.data.days).toHaveLength(5);
    expect(services.data.services.length).toBeGreaterThan(0);
    expect(resources.data.resources.length).toBeGreaterThan(0);
    expect(mockUsage).not.toHaveBeenCalled();
  });

  it("données déterministes pour un même abonnement", async () => {
    const a = await load({ USE_MOCK_COST_DATA: "true" }).queryDailyCosts("sub-1", 5);
    const b = await load({ USE_MOCK_COST_DATA: "true" }).queryDailyCosts("sub-1", 5);
    expect(a.data).toEqual(b.data);
  });
});
