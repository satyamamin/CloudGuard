import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";
import * as Sentry from "@sentry/nestjs";
import { AzureQuotaExceededException } from "../exceptions/azure-quota-exceeded.exception";

// The one place that knows Azure 429s map to a clean 503 -- CostsService and
// the controllers stay unaware of this shape, same pattern as ValidationPipe
// centralizing validation-error shaping (see main.ts).
@Catch(AzureQuotaExceededException)
export class AzureQuotaExceededFilter implements ExceptionFilter {
  catch(exception: AzureQuotaExceededException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    // Only calls Sentry.captureMessage if main.ts actually initialized the
    // SDK (SENTRY_DSN set) -- Sentry.init() is a no-op without a DSN, but
    // captureMessage would still silently queue events nobody's reading, so
    // gate on the env var directly rather than relying on that behavior.
    if (process.env.SENTRY_DSN) {
      Sentry.captureMessage(exception.message, {
        level: "warning",
        tags: {
          azureSubscriptionId: exception.azureSubscriptionId,
          endpoint: exception.endpoint,
          retryAfterSeconds: exception.retryAfterSeconds ?? "unknown",
        },
      });
    } else {
      console.warn("[AzureQuotaExceeded]", {
        azureSubscriptionId: exception.azureSubscriptionId,
        endpoint: exception.endpoint,
        retryAfterSeconds: exception.retryAfterSeconds ?? "unknown",
      });
    }

    response.status(503).json({
      statusCode: 503,
      message: "Cost data is temporarily unavailable while we refresh from Azure. Please try again in a few minutes.",
    });
  }
}
