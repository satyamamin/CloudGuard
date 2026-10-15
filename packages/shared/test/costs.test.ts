import { describe, expect, it } from "vitest";
import {
  accumulatedCostsResponseSchema,
  costByResourceResponseSchema,
  costByServiceResponseSchema,
  dailyCostsResponseSchema,
} from "../src";

const envelope = { currency: "EUR", from: "2026-08-01", to: "2026-08-02" };

describe("schémas de réponses /costs/*", () => {
  it("daily : accepte une réponse valide", () => {
    const r = dailyCostsResponseSchema.safeParse({ ...envelope, days: [{ date: "2026-08-01", cost: 1.5 }] });
    expect(r.success).toBe(true);
  });

  it("daily : refuse un coût non numérique (contrat backend ↔ frontend)", () => {
    const r = dailyCostsResponseSchema.safeParse({ ...envelope, days: [{ date: "2026-08-01", cost: "1.5" }] });
    expect(r.success).toBe(false);
  });

  it("accumulated : exige cumulativeCost", () => {
    expect(accumulatedCostsResponseSchema.safeParse({ ...envelope, days: [{ date: "2026-08-01" }] }).success).toBe(false);
    expect(
      accumulatedCostsResponseSchema.safeParse({ ...envelope, days: [{ date: "2026-08-01", cumulativeCost: 3 }] }).success,
    ).toBe(true);
  });

  it("by-service : exige serviceName", () => {
    expect(costByServiceResponseSchema.safeParse({ ...envelope, services: [{ cost: 1 }] }).success).toBe(false);
    expect(costByServiceResponseSchema.safeParse({ ...envelope, services: [{ serviceName: "Storage", cost: 1 }] }).success).toBe(true);
  });

  it("by-resource : exige resourceId et resourceName", () => {
    expect(costByResourceResponseSchema.safeParse({ ...envelope, resources: [{ resourceId: "/x", cost: 1 }] }).success).toBe(false);
    expect(
      costByResourceResponseSchema.safeParse({ ...envelope, resources: [{ resourceId: "/x", resourceName: "x", cost: 1 }] }).success,
    ).toBe(true);
  });

  it("refuse une enveloppe sans devise", () => {
    expect(dailyCostsResponseSchema.safeParse({ from: "a", to: "b", days: [] }).success).toBe(false);
  });
});
