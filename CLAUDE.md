# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository actually is

This repo contains **two unrelated layers**, not a single application:

1. **The real CloudGuard 360 product** — an npm-workspaces monorepo (`apps/`, `packages/`, `infra/bicep`) implementing the v1 "Connect Azure" onboarding flow. This is where active development happens.
2. **Planning artifacts** for the product — `docs/connect-azure.md` (current, authoritative) and `docs/initial-vision-archive.md` (a consolidated, explicitly-historical snapshot of the founder's original pre-build vision — superseded, kept for reference only). Not part of the shipped product.

(The repo used to also carry a generic, unfilled Terraform/Makefile/.azuredevops template left over from the starter repo it was cloned from — removed as dead weight; it never shared config or CI with the monorepo above. `.github/workflows/build-api-image.yml` is real, active CI though — it builds/pushes `apps/api`'s Docker image to GHCR, which `infra/bicep/main.bicep` deploys by default.)

## Architecture (v1 — customer-hosted, no CloudGuard backend)

The core architectural decision, documented in **`docs/connect-azure.md`** (read this before touching the connect flow — it is the source of truth and supersedes the older Service-Principal/shared-backend version of the doc):

- CloudGuard has **no backend or database of its own**. A customer provisions the backend + Postgres directly **inside their own Azure tenant** via a "Deploy to Azure" button (ARM/Bicep). CloudGuard only hosts the frontend centrally (Next.js, intended for Vercel).
- The deployed backend authenticates to Azure Cost Management / Resource Graph via a **system-assigned Managed Identity** — no client secret is ever entered, stored, or transmitted (this replaced an earlier cross-tenant `ClientSecretCredential` design).
- Isolation between customers is **physical** (one Postgres instance per deployment), not row-level — there is no multi-tenancy scoping column in the schema.
- The frontend pairs with a customer's deployed instance via a `Backend URL` + `API key` (shown once as a deployment output), stored in **Clerk private organization metadata** — deliberately not a CloudGuard-side database, and deliberately not Clerk *public* metadata (which is client-readable). All reads/writes of the pairing happen server-side.

### Monorepo layout

```
apps/api/       NestJS backend — the code deployed into the customer's tenant
apps/web/       Next.js frontend — the only thing CloudGuard hosts centrally
packages/shared/  Zod schemas + types shared by both apps (built to dist/, consumed as a normal compiled workspace dependency — not source-transpiled by either bundler)
infra/bicep/    The "Deploy to Azure" template
```

**`apps/api`** implements exactly 5 endpoints (see `docs/connect-azure.md` for the full contract) — `GET /health`, `GET /subscriptions`, `POST /subscriptions/select`, `GET /status`, `POST /sync` — behind a single global API-key guard (`src/auth/api-key.guard.ts`, registered as `APP_GUARD`), applied to *every* route including `/health`. One Prisma model, `Instance` (`prisma/schema.prisma`) — a singleton row per deployment, fetched/created via `InstanceService.getOrCreate()`, never looked up by a caller-supplied ID. Azure calls go through `src/azure/`: `AzureCredentialProvider` picks `DefaultAzureCredential` (production, resolves the Managed Identity) or `AzureCliCredential` (local dev, requires `az login`) based on `AZURE_AUTH_MODE`. `/sync` is synchronous and re-entrancy-locked in-memory (`SyncService`) — this is only correct because the Container App is pinned to `minReplicas=maxReplicas=1` in the Bicep template; don't scale it without revisiting that lock and the migration-on-boot strategy below.

**`infra/bicep`** is deployed at resource-group scope (all the Azure Portal's "Deploy a custom template" flow allows), but the Reader + Cost Management Reader role assignments must be subscription-scoped — `modules/role-assignments.bicep` declares `targetScope = 'subscription'` and is invoked from `main.bicep` with an explicit `scope: subscription()`, a real Bicep feature (a module's scope can differ from its parent deployment's). Prisma migrations run from `apps/api/docker-entrypoint.sh` at container boot (`prisma migrate deploy`), not from CI — there is no pipeline that reaches into a customer's tenant.

**`apps/web`**'s `/connect-azure` page composes: a deploy-link button (built from `NEXT_PUBLIC_BICEP_TEMPLATE_URI`) → `PairingForm` (posts to `app/api/instance/route.ts`, which calls the paired backend's `/health` before persisting) → `OnboardingStepper` (discover/select/sync against `app/api/instance/subscriptions/route.ts` and `.../sync/route.ts`). All three of those route handlers are the *only* code allowed to read/write the pairing (`lib/clerk-org-metadata.ts`, marked `server-only`) or call the customer's backend (`lib/backend-client.ts`, also `server-only`) — client components only ever see a redacted `apiKeyLast4`.

## Commands

Monorepo (from repo root):

```
npm install                    # installs all workspaces
npm run dev:api                # apps/api in watch mode
npm run dev:web                # apps/web (Next.js dev server)
npm run build                  # packages/shared -> apps/api -> apps/web, in order
npm run build:shared           # packages/shared only (do this first if apps/* fail to resolve @cloudguard/shared)
```

`apps/api` (from `apps/api/`, or via `-w apps/api` from root):

```
docker compose -f docker-compose.dev.yml up -d   # local Postgres
npx prisma generate --schema apps/api/prisma/schema.prisma
npm run prisma:migrate:dev -w apps/api           # creates/applies a migration against the local DB
npm run build -w apps/api                        # nest build
npm run start:dev -w apps/api                     # requires DATABASE_URL, API_KEY, AZURE_AUTH_MODE, FRONTEND_ORIGIN, PORT — see apps/api/.env.example
```

For real Azure calls locally, set `AZURE_AUTH_MODE=cli` and `az login` first — `DefaultAzureCredential` (the production path) only resolves inside a deployed Container App's Managed Identity.

`apps/web`:

```
npm run dev -w apps/web    # needs NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, NEXT_PUBLIC_BICEP_TEMPLATE_URI — see apps/web/.env.local.example
npm run build -w apps/web
npm run lint -w apps/web
```

`infra/bicep` (requires `az bicep install` once):

```
az bicep build --file infra/bicep/main.bicep --outfile infra/bicep/main.json   # rebuild after any change; main.json is a committed deploy artifact, not a discardable build output
az deployment group validate --resource-group <test-rg> --template-file infra/bicep/main.json
```

No test runner is configured anywhere in the repo yet.

## Clerk setup gotcha (apps/web)

Clerk Organizations must be enabled with **"Membership required"** (every signed-in user needs an active org — `middleware.ts` and every `app/api/instance/*` route read `auth().orgId`). This is *not* enough on its own: a fresh Clerk application's session token does not include `org_id`/`org_role`/`org_slug` claims by default. If `auth().orgId` is `undefined` even for a user with a real, confirmed organization membership (verified via the Clerk backend API showing `last_active_organization_id` set on the session), the fix is in the Clerk Dashboard, not the code: **Configure → Sessions → Customize session token**, add:
```json
{ "org_id": "{{org.id}}", "org_slug": "{{org.slug}}", "org_role": "{{org.role}}" }
```
Existing sessions pick this up automatically (tokens refresh every ~60s); no user-facing repro like signing out/in is actually required once the claim is added. `apps/web/app/layout.tsx` already renders `OrganizationSwitcher` + `UserButton` for local org creation/selection during dev.

## Security note

An ARM/Bicep deployment `output` (the customer's API key, generated by `main.bicep`) is **not actually ephemeral** — it stays visible in the resource group's Deployment history to anyone with read access, despite `docs/connect-azure.md`'s "shown once" framing. This is a known, accepted v1 gap (see `infra/bicep/README.md`), not a bug to silently fix.
