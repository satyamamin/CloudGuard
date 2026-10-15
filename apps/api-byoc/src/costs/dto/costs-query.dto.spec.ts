import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CostsQueryDto } from "./costs-query.dto";

const errorsFor = async (plain: object) => validate(plainToInstance(CostsQueryDto, plain));

describe("CostsQueryDto", () => {
  it("accepte une requête vide (tout est optionnel)", async () => {
    expect(await errorsFor({})).toHaveLength(0);
  });

  it.each([1, 30, 90, 366])("accepte days=%s", async (days) => {
    expect(await errorsFor({ days })).toHaveLength(0);
  });

  it.each([0, -5, 367, 1000, 1.5, "abc"])("refuse days=%p", async (days) => {
    expect((await errorsFor({ days })).length).toBeGreaterThan(0);
  });

  it("convertit days reçu en chaîne (query string)", async () => {
    const dto = plainToInstance(CostsQueryDto, { days: "45" });
    expect(dto.days).toBe(45);
    expect(await validate(dto)).toHaveLength(0);
  });
});

describe("ValidationPipe global (même réglage que main.ts)", () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const meta = { type: "query" as const, metatype: CostsQueryDto };

  it("rejette les paramètres inconnus", async () => {
    await expect(pipe.transform({ days: "10", admin: "true" }, meta)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("laisse passer une requête valide", async () => {
    await expect(pipe.transform({ days: "10", subscriptionId: "abc" }, meta)).resolves.toMatchObject({
      days: 10,
      subscriptionId: "abc",
    });
  });
});
