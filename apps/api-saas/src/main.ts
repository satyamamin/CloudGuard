import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Comma-separated to allow multiple frontend environments (e.g. local dev
  // + a preview deployment) — production only ever sets one origin.
  const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "").split(",").map((origin) => origin.trim());
  app.enableCors({ origin: allowedOrigins });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 3002, not apps/api's 3001 — both backends can run side by side locally.
  const port = process.env.PORT ? Number(process.env.PORT) : 3002;
  await app.listen(port);
}

bootstrap();
