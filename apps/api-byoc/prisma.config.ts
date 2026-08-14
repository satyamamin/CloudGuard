// Prisma 7 moved the connection URL out of schema.prisma (no longer a valid
// `datasource.url` field there) and into this file. `env()` below reads
// only from process.env -- it does NOT auto-load a .env file the way
// Prisma's legacy CLI did (confirmed the hard way: standalone `npx prisma
// studio`, with no env vars pre-exported, fails with `PrismaConfigEnvError:
// Cannot resolve environment variable: DATABASE_URL`). `dotenv/config`
// below restores that convenience for any Prisma CLI invocation run
// straight from a shell (prisma studio, migrate, generate) without
// requiring the caller to export vars first -- safe in every other context
// too: Container Apps/docker-entrypoint.sh/apps/api-byoc's own NestJS app
// already have DATABASE_URL as a real env var, dotenv doesn't override an
// already-set value, and no .env file even ships in the Docker image for it
// to find.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
