import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
// Generated to ../../generated/prisma-client (see schema.prisma), not the
// shared "@prisma/client" package resolution — isolates this app's client
// from apps/api's differently-shaped one in the hoisted node_modules.
import { Prisma, PrismaClient } from "../../generated/prisma-client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Every query against a table with a tenant-isolation RLS policy (today:
  // azure_connection — see the enable_rls_azure_connection migration) must
  // run inside this wrapper. set_config(..., true) is transaction-local
  // ("true" = the `local` flag), so the tenant context can never leak onto
  // a pooled connection's next, unrelated request the way a bare `SET`
  // would. Callers pass the tenantId resolved by ClerkAuthGuard/TenantService
  // — never a client-supplied value.
  async runInTenantContext<T>(tenantId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    });
  }
}
