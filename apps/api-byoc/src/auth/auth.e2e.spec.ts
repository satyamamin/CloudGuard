import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AuthModule } from "./auth.module";
import { HealthModule } from "../health/health.module";

// Vérifie que le guard est bien GLOBAL (APP_GUARD) : une route ajoutée plus
// tard sans décorateur reste protégée, /health compris.
describe("Auth globale (e2e léger)", () => {
  let app: INestApplication;
  const originalKey = process.env.API_KEY;

  beforeAll(async () => {
    process.env.API_KEY = "e2e-secret";
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule, HealthModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (originalKey === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = originalKey;
  });

  it("GET /health sans clé → 401", async () => {
    await request(app.getHttpServer()).get("/health").expect(401);
  });

  it("GET /health avec mauvaise clé → 401", async () => {
    await request(app.getHttpServer()).get("/health").set("Authorization", "Bearer nope").expect(401);
  });

  it("GET /health avec la bonne clé → 200 et { status: ok }", async () => {
    const res = await request(app.getHttpServer()).get("/health").set("Authorization", "Bearer e2e-secret").expect(200);
    expect(res.body).toMatchObject({ status: "ok" });
  });
});
