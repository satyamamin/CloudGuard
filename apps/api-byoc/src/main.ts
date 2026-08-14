import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { AppModule } from "./app.module";
import { AzureQuotaExceededFilter } from "./common/filters/azure-quota-exceeded.filter";

// Optional: only initialized if SENTRY_DSN is set, so this ships without
// requiring a Sentry account to exist yet (see AzureQuotaExceededFilter's
// console.warn fallback for the no-DSN case).
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Comma-separated in local dev to also allow the standalone API viewer
  // page (dev-test/viewer); production only ever sets one origin.
  const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "").split(",").map((origin) => origin.trim());
  app.enableCors({
    origin: allowedOrigins,
    // Browsers hide all but a few "simple" response headers from JS by
    // default — exposeHeaders is required for the viewer's cache indicator.
    exposedHeaders: ["X-Cache"],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AzureQuotaExceededFilter());

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
}

bootstrap();
