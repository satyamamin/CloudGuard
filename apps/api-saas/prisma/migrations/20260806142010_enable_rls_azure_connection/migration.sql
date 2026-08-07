-- Row-Level Security for azure_connection: this is the DB-enforced backstop
-- against a missing `tenantId` filter in application code (docs/cloudguard-hosted.md's
-- Open Items flags this as decided-but-not-built until now). Every session
-- must set app.tenant_id (via PrismaService.runInTenantContext, using
-- set_config(..., true) so it's transaction-local) before querying this
-- table; without it, current_setting(...) returns NULL and every row is
-- hidden — fail closed, not fail open.
--
-- FORCE is required, not just ENABLE: the app connects as the table-owning
-- role (no separate low-privilege DB role is configured), and Postgres
-- exempts the owning role from RLS by default. Without FORCE, this policy
-- would be silently inert for every real query the app makes.
ALTER TABLE "azure_connection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "azure_connection" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "azure_connection"
  USING (current_setting('app.tenant_id', true) = "tenantId")
  WITH CHECK (current_setting('app.tenant_id', true) = "tenantId");

-- Deliberately NOT applied to "tenant": that table is the bootstrap lookup
-- (resolve a Tenant row from a Clerk-verified clerkOrgId, before any
-- tenantId is known to set as session context) and holds no Azure data of
-- its own. Isolation for it comes from the Clerk JWT verification in
-- ClerkAuthGuard, not from RLS.
