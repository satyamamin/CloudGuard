# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository actually is

This repo contains **two unrelated layers**, not a single application:

1. **The real CloudGuard 360 product** — an npm-workspaces monorepo (`apps/`, `packages/`, `infra/bicep`) implementing the v1 "Connect Azure" onboarding flow. This is where active development happens. `apps/api-saas` also lives here (see below) but is **scaffolded and frozen, not part of what ships** — don't build on it without checking with the user first.
2. **Planning artifacts** for the product — `docs/connect-azure.md` (current, authoritative, the tier that actually ships), `docs/cloudguard-hosted.md` (SaaS-tier architecture — decisions are locked but the tier itself is deferred post-v1, see below), `docs/architecture.md` (canonical per-layer infra choice + build status across both tiers), `docs/initial-vision-archive.md` (a consolidated, explicitly-historical snapshot of the founder's original pre-build vision — superseded, kept for reference only), and `docs/plan/` (not-yet-built implementation plans: `daily-synced-cost-history.md`, `azure-cost-management-endpoints.md`, `frontend-design-decisions.md`). Not part of the shipped product.

(The repo used to also carry a generic, unfilled Terraform/Makefile/.azuredevops template left over from the starter repo it was cloned from — removed as dead weight; it never shared config or CI with the monorepo above. `.github/workflows/build-api-image.yml` is real, active CI though — it builds/pushes `apps/api`'s Docker image to GHCR, which `infra/bicep/main.bicep` deploys by default.)

## Scope decision: v1 ships BYOC-only

As of 2026-08-06, initial shipping is **BYOC-only** — the flow already built and documented in `docs/connect-azure.md` (Bicep "Deploy to Azure" + Managed Identity), stuck with deliberately because it needs zero CloudGuard-owned Azure infrastructure and reuses 100% of already-shipped work. Two things are explicitly deferred, not abandoned:

- **The SaaS tier** (`apps/api-saas`, a separate centrally-hosted multi-tenant backend on Railway/Neon, cross-tenant Azure access via a CloudGuard-owned multi-tenant App Registration) — architecture is fully designed and locked in `docs/cloudguard-hosted.md`, and the backend is scaffolded (health endpoint, `Tenant`/`AzureConnection` schema with Row-Level Security shipped and verified — see below), but paused before the connection/consent flow was built. Revisit after initial customer traction.
- **A manual-credential onboarding path for BYOC** — for customers who self-host `apps/api` outside Azure-managed compute (on-prem, another cloud), where Managed Identity has nothing to resolve. Not yet specified or built; `apps/api/src/azure/azure-credential.provider.ts` today only supports Managed Identity and `az login`, no `ClientSecretCredential` path.

## Architecture (v1 — customer-hosted, no CloudGuard backend)

The core architectural decision, documented in **`docs/connect-azure.md`** (read this before touching the connect flow — it is the source of truth and supersedes the older Service-Principal/shared-backend version of the doc):

- CloudGuard has **no backend or database of its own**. A customer provisions the backend + Postgres directly **inside their own Azure tenant** via a "Deploy to Azure" button (ARM/Bicep). CloudGuard only hosts the frontend centrally (Next.js, intended for Vercel).
- The deployed backend authenticates to Azure Cost Management / Resource Graph via a **system-assigned Managed Identity** — no client secret is ever entered, stored, or transmitted (this replaced an earlier cross-tenant `ClientSecretCredential` design).
- Isolation between customers is **physical** (one Postgres instance per deployment), not row-level — there is no multi-tenancy scoping column in the schema.
- The frontend pairs with a customer's deployed instance via a `Backend URL` + `API key` (shown once as a deployment output), stored in **Clerk private organization metadata** — deliberately not a CloudGuard-side database, and deliberately not Clerk *public* metadata (which is client-readable). All reads/writes of the pairing happen server-side.

### Monorepo layout

```
apps/api/       NestJS backend — the code deployed into the customer's tenant (BYOC, ships)
apps/api-saas/  NestJS backend — centrally-hosted multi-tenant SaaS tier (scaffolded, frozen — see "Scope decision" above)
apps/web/       Next.js frontend — the only thing CloudGuard hosts centrally
packages/shared/  Zod schemas + types shared by both apps (built to dist/, consumed as a normal compiled workspace dependency — not source-transpiled by either bundler)
infra/bicep/    The "Deploy to Azure" template
```

**`apps/api`**'s *documented* contract (see `docs/connect-azure.md`) is exactly 5 endpoints — `GET /health`, `GET /subscriptions`, `POST /subscriptions/select`, `GET /status`, `POST /sync` — behind a single global API-key guard (`src/auth/api-key.guard.ts`, registered as `APP_GUARD`), applied to *every* route including `/health`. One Prisma model, `Instance` (`prisma/schema.prisma`) — a singleton row per deployment, fetched/created via `InstanceService.getOrCreate()`, never looked up by a caller-supplied ID. Azure calls go through `src/azure/`: `AzureCredentialProvider` picks `DefaultAzureCredential` (production, resolves the Managed Identity) or `AzureCliCredential` (local dev, requires `az login`) based on `AZURE_AUTH_MODE`. `/sync` is synchronous and re-entrancy-locked in-memory (`SyncService`) — this is only correct because the Container App is pinned to `minReplicas=maxReplicas=1` in the Bicep template; don't scale it without revisiting that lock and the migration-on-boot strategy below.

**`src/costs/`** adds 4 more GET endpoints beyond that documented contract — `/costs/daily`, `/costs/accumulated`, `/costs/by-service`, `/costs/by-resource` — built ahead of real dashboard/frontend work, not yet reflected in `docs/connect-azure.md`. All route through `CostManagementService` (`src/azure/cost-management.service.ts`), which wraps Azure's single `client.query.usage()` SDK call with different `dataset.grouping`/`granularity` per view, plus an in-memory 30-minute cache (reported via an `X-Cache: HIT`/`MISS` response header — `main.ts`'s CORS config needs `exposedHeaders` for any new header like this to be readable by browser JS). `/costs/accumulated` makes **no Azure call of its own** — it's a derived running-sum transform of `/costs/daily`'s (cached) data, so the two endpoints share one cache entry. Two Azure-specific gotchas baked into `customDateRange()`: (1) Azure rejects a `to` timestamp containing today's exact time-of-day as "in the future" (same-day data isn't fully processed) — dates are normalized to UTC-midnight boundaries, never the literal current instant; (2) the Custom timeframe is inclusive on both ends, so "last N days" means `today - (N-1)`, not `today - N`. Cost Management's throttling (`429 Too many requests`) is scoped **per subscription being queried, not per calling identity** — confirmed empirically; switching Azure identities doesn't grant a fresh quota against the same subscription, so the cache (not identity-juggling) is the real mitigation. `local-dev-test/viewer/index.html` is a standalone, dependency-free HTML page for exercising these 4 endpoints outside the real frontend — serve via `npx http-server local-dev-test/viewer -p 5500` (requires `http://localhost:5500` present in `apps/api/.env`'s comma-separated `FRONTEND_ORIGIN`).

**`infra/bicep`** is deployed at resource-group scope (all the Azure Portal's "Deploy a custom template" flow allows), but the Reader + Cost Management Reader role assignments must be subscription-scoped — `modules/role-assignments.bicep` declares `targetScope = 'subscription'` and is invoked from `main.bicep` with an explicit `scope: subscription()`, a real Bicep feature (a module's scope can differ from its parent deployment's). Prisma migrations run from `apps/api/docker-entrypoint.sh` at container boot (`prisma migrate deploy`), not from CI — there is no pipeline that reaches into a customer's tenant.

**`apps/web`**'s `/connect-azure` page composes: a deploy-link button (built from `NEXT_PUBLIC_BICEP_TEMPLATE_URI`) → `PairingForm` (posts to `app/api/instance/route.ts`, which calls the paired backend's `/health` before persisting) → `OnboardingStepper` (discover/select/sync against `app/api/instance/subscriptions/route.ts` and `.../sync/route.ts`). All three of those route handlers are the *only* code allowed to read/write the pairing (`lib/clerk-org-metadata.ts`, marked `server-only`) or call the customer's backend (`lib/backend-client.ts`, also `server-only`) — client components only ever see a redacted `apiKeyLast4`. Note: `OnboardingStepper` collapses any non-OK response from these route handlers into a generic error ("Could not discover subscriptions", etc.) — the real cause (backend unreachable, Azure auth failure, whatever) is swallowed client-side; check `apps/api`'s own logs when diagnosing, not just the browser error text.

**`apps/web/app/dashboard`** is the ongoing product surface (as opposed to `/connect-azure`'s one-time onboarding), proxying `apps/api`'s 4 `/costs/*` endpoints through the same two-layer pattern as onboarding: `lib/backend-client.ts` methods → `app/api/instance/costs/{daily,accumulated,by-service,by-resource}/route.ts` (auth check → pairing lookup → backend call), never the customer's API key reaching the browser. `app/dashboard/layout.tsx` is shared chrome (nav, subscription switcher, period selector) around `page.tsx` (Overview: 3 KPI tiles + accumulated hero chart) and one detail page per view (`daily/`, `by-service/`, `by-resource/`). Two URL search params, not React state, drive filtering everywhere — `?subscriptionId=` and `?days=` — so every page is server-rendered/bookmarkable and filters persist across nav; `PeriodSelector`/`SubscriptionSwitcher` (`components/dashboard/`) just push new query strings. `SubscriptionSwitcher` deliberately filters the full Azure subscription list down to only `Instance.selectedSubscriptionIds` — `/costs/*` has no synced context for a subscription that was never selected during onboarding, so unselected ones aren't offered; if a customer paired more subscriptions than they see in the dropdown, that's this filter, not a bug — the fix is re-running subscription selection, not the component. The Overview page (`app/dashboard/page.tsx`) fetches `dailyCosts({ days: days * 2 })` once and derives both the prior-period delta and the accumulated/cumulative series from that single response client-side, rather than making 3 separate Azure-backed calls. Charting is Recharts (`^3.10.1`) — note its exported `Tooltip` is **not actually generic** despite `TooltipContentProps<Value,Name>` being a parameterizable type alias in the `.d.ts` files; `<Tooltip<number,string>>` JSX generic instantiation fails with "Expected 0 type arguments, but got 2". Use the unparameterized `TooltipContentProps` default and pass `content={(props) => <ChartTooltip {...props} .../>}` (a function, not a JSX element — Recharts clones tooltip props at runtime in a way static JSX typing can't verify), coercing `payload[0]?.value` (typed as the broad `ValueType`) with `Number(...)` where it feeds a `number`-typed formatter. Design tokens for charts live in a `.dashboard-root`-scoped CSS custom-property block in `globals.css` (light values + `@media (prefers-color-scheme: dark)` override, sourced from the `dataviz` skill's reference palette) — there is no manual theme toggle in this app, dark mode is OS-preference-only.

## SaaS tier (`apps/api-saas`) — scaffolded, currently frozen

Full architecture, decisions, and rationale live in `docs/cloudguard-hosted.md` — read that before resuming this tier, don't re-derive it. Summary of what exists today: a separate NestJS app, multi-tenant from the ground up (`Tenant` + `AzureConnection` Prisma models, no singleton-instance assumption like `apps/api`), with its own isolated Prisma client output (`apps/api-saas/generated/prisma-client` — deliberately not the shared hoisted `node_modules/.prisma/client` `apps/api` uses, to prevent the two schemas from overwriting each other's generated client). `ClerkAuthGuard` verifies the Clerk session JWT directly (no per-tenant API keys, unlike `apps/api`'s single global one — that pattern doesn't work once there's more than one tenant). Only `GET /health` is wired up; no connection flow, no cost endpoints, nothing reachable from `apps/web` yet.

**Row-Level Security is shipped and verified on `azure_connection`** (`enable_rls_azure_connection` migration) — the one piece of this tier that's genuinely done, not just scaffolded. The non-obvious part, worth knowing before touching this schema again: RLS is silently inert unless the connecting DB role lacks `BYPASSRLS`. Both the local Postgres bootstrap role *and* Neon's default `neon_superuser`-derived role have `BYPASSRLS` — so the app's runtime `DATABASE_URL` must be a separately-created, restricted role (`apps/api-saas/local-dev-init.sql` sets this up locally as `cloudguard_app`), while migrations use a different, elevated connection string via Prisma's `directUrl` (`MIGRATE_DATABASE_URL` in `.env`) — `prisma/schema.prisma`'s `datasource` block wires this split. Every tenant-scoped query must go through `PrismaService.runInTenantContext()`, which sets `app.tenant_id` transaction-locally (`set_config(..., true)`, never a bare `SET`, so it can't leak across a pooled connection).

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
docker compose -f docker-compose.dev.yml up -d postgres   # local Postgres (the file also has a postgres-saas service, port 5433, for apps/api-saas — see below)
npx prisma generate --schema apps/api/prisma/schema.prisma
npm run prisma:migrate:dev -w apps/api           # creates/applies a migration against the local DB
npm run build -w apps/api                        # nest build
npm run start:dev -w apps/api                     # requires DATABASE_URL, API_KEY, AZURE_AUTH_MODE, FRONTEND_ORIGIN, PORT — see apps/api/.env.example
```

`apps/api` has **no `dotenv` loading of its own** — `nest start` does not read `.env` files automatically, so the env vars above must actually be present in the shell's environment, not just sitting in `apps/api/.env`. `local-dev-test/test-local-dev.ps1` handles this correctly (parses `apps/api/.env` and exports each value into the child process it spawns) — but running `npm run dev:api`/`npm run start:dev -w apps/api` directly in a fresh shell that hasn't sourced those vars will crash immediately with `PrismaClientInitializationError: Environment variable not found: DATABASE_URL`. That's an environment issue, not an application bug.

For real Azure calls locally, set `AZURE_AUTH_MODE=cli` and `az login` first — `DefaultAzureCredential` (the production path) only resolves inside a deployed Container App's Managed Identity. If `az login` sessions keep expiring every few hours (`AADSTS70043`), that's Conditional Access sign-in-frequency policy on a personal account, not a bug — `local-dev-test/ensure-az-login.ps1` logs in non-interactively via a Service Principal instead (only re-authenticates when the token has actually expired; real credentials live in the gitignored `local-dev-test/.env`, never committed). `local-dev-test/test-local-dev.ps1` chains that with the rest of the local startup sequence (Postgres, `apps/api`, `apps/web`, health check, opening the browser) — idempotent, skips anything already running.

`apps/api-saas` (from `apps/api-saas/`, or via `-w apps/api-saas` from root) — see "SaaS tier" above for why this is frozen:

```
docker compose -f docker-compose.dev.yml up -d postgres-saas   # local Neon stand-in, port 5433 — also runs apps/api-saas/local-dev-init.sql on a fresh volume
npx prisma migrate dev --schema apps/api-saas/prisma/schema.prisma   # uses MIGRATE_DATABASE_URL (directUrl) automatically, not DATABASE_URL
npm run build -w apps/api-saas
npm run start:dev -w apps/api-saas   # DATABASE_URL here must be the restricted cloudguard_app role, not the Postgres bootstrap role — see apps/api-saas/.env.example
```

`apps/web`:

```
npm run dev -w apps/web    # needs NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, NEXT_PUBLIC_BICEP_TEMPLATE_URI — see apps/web/.env.local.example
npm run build -w apps/web
npm run lint -w apps/web
```

`apps/web/.eslintrc.json` (`{"extends": "next/core-web-vitals"}`) and `eslint`/`eslint-config-next` are already installed and committed. If ESLint ever needs reinstalling, don't let `next lint`'s interactive setup auto-install — it defaults to `pnpm` on this machine, which can't resolve the workspace-internal `@cloudguard/shared` package and fails with a registry 404. Install via `npm install -D eslint@^8 eslint-config-next@^14 -w apps/web` instead, pinned to match the installed `next` major version (latest `eslint-config-next` requires ESLint 9).

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
