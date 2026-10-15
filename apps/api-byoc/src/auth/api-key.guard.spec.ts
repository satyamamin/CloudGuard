import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ApiKeyGuard } from "./api-key.guard";

function contextWith(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
  } as unknown as ExecutionContext;
}

describe("ApiKeyGuard", () => {
  const guard = new ApiKeyGuard();
  const originalKey = process.env.API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = originalKey;
  });

  it("accepte la bonne clé au format Bearer", () => {
    process.env.API_KEY = "secret";
    expect(guard.canActivate(contextWith("Bearer secret"))).toBe(true);
  });

  it.each([
    ["en-tête absent", undefined],
    ["en-tête vide", ""],
    ["Bearer sans clé", "Bearer "],
    ["mauvaise clé", "Bearer wrong"],
    ["clé sans schéma", "secret"],
    ["autre schéma (Basic)", "Basic secret"],
    ["casse du schéma différente", "bearer secret"],
  ])("refuse : %s", (_label, header) => {
    process.env.API_KEY = "secret";
    expect(() => guard.canActivate(contextWith(header))).toThrow(UnauthorizedException);
  });

  it("refuse tout si API_KEY n'est pas configurée (jamais d'accès ouvert par défaut)", () => {
    delete process.env.API_KEY;
    expect(() => guard.canActivate(contextWith("Bearer undefined"))).toThrow("API_KEY is not configured");
    expect(() => guard.canActivate(contextWith("Bearer "))).toThrow(UnauthorizedException);
  });
});
