import { BadRequestException } from "@nestjs/common";
import { RestError, createHttpHeaders } from "@azure/core-rest-pipeline";
import { CostsService } from "./costs.service";
import { AzureQuotaExceededException } from "../common/exceptions/azure-quota-exceeded.exception";

// Évite de charger Prisma (client généré) et le SDK Azure : on teste la logique pure.
jest.mock("../instance/instance.service", () => ({ InstanceService: class {} }));
jest.mock("../azure/cost-management.service", () => ({ CostManagementService: class {} }));

function throttled(headers: Record<string, string> = {}) {
  return new RestError("Too Many Requests", {
    statusCode: 429,
    response: { status: 429, headers: createHttpHeaders(headers) } as never,
  });
}

function build(overrides: { selected?: string[]; queryDailyCosts?: jest.Mock } = {}) {
  const cost = {
    queryDailyCosts: overrides.queryDailyCosts ?? jest.fn().mockResolvedValue({ data: { days: [] }, cached: false }),
    queryAccumulatedCosts: jest.fn().mockResolvedValue({ data: { days: [] }, cached: true }),
    queryCostByService: jest.fn().mockResolvedValue({ data: { services: [] }, cached: false }),
    queryCostByResource: jest.fn().mockResolvedValue({ data: { resources: [] }, cached: false }),
  };
  const instance = {
    getOrCreate: jest.fn().mockResolvedValue({ selectedSubscriptionIds: overrides.selected ?? ["sub-default"] }),
  };
  return { service: new CostsService(cost as never, instance as never), cost, instance };
}

describe("CostsService — résolution de l'abonnement", () => {
  it("utilise le subscriptionId fourni sans toucher à l'instance", async () => {
    const { service, cost, instance } = build();
    await service.getDailyCosts("sub-explicit", 30);
    expect(cost.queryDailyCosts).toHaveBeenCalledWith("sub-explicit", 30);
    expect(instance.getOrCreate).not.toHaveBeenCalled();
  });

  it("retombe sur le premier abonnement sélectionné", async () => {
    const { service, cost } = build({ selected: ["sub-a", "sub-b"] });
    await service.getCostByService(undefined, 7);
    expect(cost.queryCostByService).toHaveBeenCalledWith("sub-a", 7);
  });

  it("400 si aucun abonnement n'est sélectionné ni fourni", async () => {
    const { service } = build({ selected: [] });
    await expect(service.getCostByResource(undefined, 30)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("CostsService — protection quota Azure (429)", () => {
  it("transforme un 429 en AzureQuotaExceededException avec le plus grand retry-after", async () => {
    const queryDailyCosts = jest.fn().mockRejectedValue(
      throttled({
        "x-ms-ratelimit-microsoft.costmanagement-qpu-retry-after": "30",
        "x-ms-ratelimit-microsoft.costmanagement-entity-retry-after": "120",
        "x-ms-ratelimit-microsoft.costmanagement-tenant-retry-after": "60",
      }),
    );
    const { service } = build({ queryDailyCosts });

    const error = await service.getDailyCosts("sub-1", 30).catch((e) => e);
    expect(error).toBeInstanceOf(AzureQuotaExceededException);
    expect(error).toMatchObject({ azureSubscriptionId: "sub-1", endpoint: "/costs/daily", retryAfterSeconds: 120 });
  });

  it("retryAfterSeconds est undefined si Azure n'envoie aucun en-tête retry-after", async () => {
    const { service } = build({ queryDailyCosts: jest.fn().mockRejectedValue(throttled()) });
    await expect(service.getDailyCosts("sub-1", 30)).rejects.toMatchObject({ retryAfterSeconds: undefined });
  });

  it("laisse passer les erreurs qui ne sont pas des 429", async () => {
    const { service } = build({ queryDailyCosts: jest.fn().mockRejectedValue(new Error("boom")) });
    await expect(service.getDailyCosts("sub-1", 30)).rejects.toThrow("boom");
  });

  it("laisse passer un RestError non-429 (ex. 403)", async () => {
    const forbidden = new RestError("Forbidden", { statusCode: 403 });
    const { service } = build({ queryDailyCosts: jest.fn().mockRejectedValue(forbidden) });
    await expect(service.getDailyCosts("sub-1", 30)).rejects.toBe(forbidden);
  });

  it("propage le flag cached renvoyé par le service Azure", async () => {
    const { service } = build();
    const result = await service.getAccumulatedCosts("sub-1", 30);
    expect(result.cached).toBe(true);
  });
});
