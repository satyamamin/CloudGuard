-- Local-dev-only. Mirrors a production requirement (see
-- docs/cloudguard-hosted.md): the app's runtime DB role must NOT have
-- BYPASSRLS, or the azure_connection RLS policy (see the
-- enable_rls_azure_connection migration) is silently inert. This isn't
-- hypothetical — Neon's default role (neon_superuser, which every role
-- created via the Neon console/API/CLI inherits) has included BYPASSRLS
-- since August 2023, so the default Neon connection string would hit the
-- exact same trap. This container's bootstrap role (POSTGRES_USER=cloudguard)
-- is a superuser too, same trap, same reason this file exists.
--
-- Migrations still run as the superuser (owns the tables, can create RLS
-- policies). The app connects as this restricted role instead for actual
-- runtime queries — see apps/api-saas/.env.example.
CREATE ROLE cloudguard_app LOGIN PASSWORD 'cloudguard_app' NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO cloudguard_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cloudguard_app;
