import { ArgumentsHost } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { AzureQuotaExceededFilter } from "./azure-quota-exceeded.filter";
import { AzureQuotaExceededException } from "../exceptions/azure-quota-exceeded.exception";

jest.mock("@sentry/nestjs", () => ({ captureMessage: jest.fn(), init: jest.fn() }));

function host() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const argumentsHost = { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost;
  return { argumentsHost, status, json };
}

describe("AzureQuotaExceededFilter", () => {
  const filter = new AzureQuotaExceededFilter();
  const exception = new AzureQuotaExceededException("sub-1", "/costs/daily", 90);
  const originalDsn = process.env.SENTRY_DSN;

  afterEach(() => {
    jest.clearAllMocks();
    if (originalDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = originalDsn;
  });

  it("répond 503 avec un message neutre (aucun détail Azure exposé)", () => {
    delete process.env.SENTRY_DSN;
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const { argumentsHost, status, json } = host();

    filter.catch(exception, argumentsHost);

    expect(status).toHaveBeenCalledWith(503);
    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(503);
    expect(JSON.stringify(body)).not.toContain("sub-1");
  });

  it("sans SENTRY_DSN : console.warn, pas d'appel Sentry", () => {
    delete process.env.SENTRY_DSN;
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    filter.catch(exception, host().argumentsHost);

    expect(warn).toHaveBeenCalledWith("[AzureQuotaExceeded]", expect.objectContaining({ azureSubscriptionId: "sub-1" }));
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("avec SENTRY_DSN : envoie un événement « warning » tagué", () => {
    process.env.SENTRY_DSN = "https://example@sentry.invalid/1";

    filter.catch(exception, host().argumentsHost);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        level: "warning",
        tags: { azureSubscriptionId: "sub-1", endpoint: "/costs/daily", retryAfterSeconds: 90 },
      }),
    );
  });
});
