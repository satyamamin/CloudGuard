import { describe, expect, it } from "vitest";
import { instancePairingSchema, maskApiKey, maskedInstancePairingSchema } from "../src";

describe("instancePairingSchema", () => {
  it("accepte une URL https et une clé non vide", () => {
    const parsed = instancePairingSchema.safeParse({ backendUrl: "https://finops-lab-api.example.azurecontainerapps.io", apiKey: "k" });
    expect(parsed.success).toBe(true);
  });

  it.each([
    ["URL invalide", { backendUrl: "pas-une-url", apiKey: "k" }],
    ["clé vide", { backendUrl: "https://a.example", apiKey: "" }],
    ["clé absente", { backendUrl: "https://a.example" }],
    ["URL absente", { apiKey: "k" }],
  ])("refuse : %s", (_label, input) => {
    expect(instancePairingSchema.safeParse(input).success).toBe(false);
  });

  // Documente le comportement ACTUEL (permissif) : aujourd'hui ces URL passent.
  // Quand le schéma sera durci contre le SSRF, inverser ces attentes (voir todo ci-dessous).
  it("[état actuel] accepte encore http:// et localhost", () => {
    expect(instancePairingSchema.safeParse({ backendUrl: "http://localhost:3001", apiKey: "k" }).success).toBe(true);
  });

  it.todo("refuse http:// (https obligatoire)");
  it.todo("refuse les hôtes privés / loopback / metadata (169.254.169.254) — protection SSRF");
  it.todo("refuse les domaines hors liste autorisée (ex. *.azurecontainerapps.io)");
});

describe("maskApiKey", () => {
  it("ne garde que les 4 derniers caractères", () => {
    expect(maskApiKey("abcdef123456")).toBe("3456");
  });

  it("le résultat masqué respecte maskedInstancePairingSchema", () => {
    const masked = { backendUrl: "https://a.example", apiKeyLast4: maskApiKey("0123456789") };
    expect(maskedInstancePairingSchema.safeParse(masked).success).toBe(true);
  });

  it("ne fuit jamais la clé complète dans le schéma masqué", () => {
    const withFullKey = { backendUrl: "https://a.example", apiKeyLast4: "full-secret-key" };
    expect(maskedInstancePairingSchema.safeParse(withFullKey).success).toBe(false);
  });
});
