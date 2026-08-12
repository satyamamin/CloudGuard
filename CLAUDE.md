# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository actually is

This repo contains **two unrelated layers**, not a single application:

1. **The real CloudGuard 360 product** — an npm-workspaces monorepo (`apps/`, `packages/`, `infra/bicep`) implementing the v1 "Connect Azure" onboarding flow. This is where active development happens.
2. **Planning artifacts** for the product, organized by tier under `docs/`:
   - Shared/cross-tier, at `docs/` root: `architecture.md` (canonical per-layer infra choice + build status across both tiers), `byoc-review-and-tier-comparison.md` (session notes on the BYOC review and tier-prioritization decision), `frontend-design-decisions.md` (running log of `apps/web` UI/UX decisions, applies regardless of tier), `initial-vision-archive.md` (a consolidated, explicitly-historical snapshot of the founder's original pre-build vision — superseded, kept for reference only).
   - `docs/byoc/` — BYOC-tier docs. `connect-azure.md` (current, authoritative, the tier that actually ships) and `cost-dashboard-frontend.md`, `azure-cost-management-endpoints.md` document what's built; `docs/byoc/plan/` holds not-yet-built BYOC work (`cost-management-429-resilience.md` — Phase 1 pre-launch 429 guardrail + Phase 2 deferred synced-cost-history fallback; `finalize-byoc-flow.md` — local/real-Azure verification pass).
   - `docs/saas/plan/cloudguard-hosted.md` — SaaS-tier architecture, decisions locked but the tier itself is deferred post-v1, see below.

   Not part of the shipped product.

(The repo used to also carry a generic, unfilled Terraform/Makefile/.azuredevops template left over from the starter repo it was cloned from — removed as dead weight; it never shared config or CI with the monorepo above. `.github/workflows/build-api-image.yml` is real, active CI though — it builds/pushes `apps/api-byoc`'s Docker image to GHCR, which `infra/bicep/main.bicep` deploys by default.)

## Scope decision: v1 ships BYOC-only

As of 2026-08-06, initial shipping is **BYOC-only** — the flow already built and documented in `docs/byoc/connect-azure.md` (Bicep "Deploy to Azure" + Managed Identity), stuck with deliberately because it needs zero CloudGuard-owned Azure infrastructure and reuses 100% of already-shipped work. Two things are explicitly deferred, not abandoned:

- **The SaaS tier** (a separate centrally-hosted multi-tenant backend on Railway/Neon, cross-tenant Azure access via a CloudGuard-owned multi-tenant App Registration) — architecture is fully designed and locked in `docs/saas/plan/cloudguard-hosted.md`. A scaffold (`apps/api-saas`: health endpoint, `Tenant`/`AzureConnection` schema with Row-Level Security shipped and verified) existed and was removed from the working tree before the connection/consent flow was built — preserved in git history at commit `335dde2`, not part of the current codebase. Revisit after initial customer traction.
- **A manual-credential onboarding path for BYOC** — for customers who self-host `apps/api-byoc` outside Azure-managed compute (on-prem, another cloud), where Managed Identity has nothing to resolve. Not yet specified or built; `apps/api-byoc/src/azure/azure-credential.provider.ts` today only supports Managed Identity and `az login`, no `ClientSecretCredential` path.

## Architecture (v1 — customer-hosted, no CloudGuard backend)

The core architectural decision, documented in **`docs/byoc/connect-azure.md`** (read this before touching the connect flow — it is the source of truth and supersedes the older Service-Principal/shared-backend version of the doc):

- CloudGuard has **no backend or database of its own**. A customer provisions the backend + Postgres directly **inside their own Azure tenant** via a "Deploy to Azure" button (ARM/Bicep). CloudGuard only hosts the frontend centrally (Next.js, intended for Vercel).
- The deployed backend authenticates to Azure Cost Management / Resource Graph via a **system-assigned Managed Identity** — no client secret is ever entered, stored, or transmitted (this replaced an earlier cross-tenant `ClientSecretCredential` design).
- Isolation between customers is **physical** (one Postgres instance per deployment), not row-level — there is no multi-tenancy scoping column in the schema.
- The frontend pairs with a customer's deployed instance via a `Backend URL` + `API key` (shown once as a deployment output), stored in **Clerk private organization metadata** — deliberately not a CloudGuard-side database, and deliberately not Clerk *public* metadata (which is client-readable). All reads/writes of the pairing happen server-side.

### Monorepo layout

```
apps/api-byoc/       NestJS backend — the code deployed into the customer's tenant (BYOC, ships)
apps/web/       Next.js frontend — the only thing CloudGuard hosts centrally
packages/shared/  Zod schemas + types shared by both apps (built to dist/, consumed as a normal compiled workspace dependency — not source-transpiled by either bundler)
infra/bicep/    The "Deploy to Azure" template
```

(A SaaS-tier backend, `apps/api-saas`, previously lived here too — see "Scope decision" above and "SaaS tier" below for where it went.)

**`apps/api-byoc`**'s *documented* contract (see `docs/byoc/connect-azure.md`) is exactly 5 endpoints — `GET /health`, `GET /subscriptions`, `POST /subscriptions/select`, `GET /status`, `POST /sync` — behind a single global API-key guard (`src/auth/api-key.guard.ts`, registered as `APP_GUARD`), applied to *every* route including `/health`. One Prisma model, `Instance` (`prisma/schema.prisma`) — a singleton row per deployment, fetched/created via `InstanceService.getOrCreate()`, never looked up by a caller-supplied ID. Azure calls go through `src/azure/`: `AzureCredentialProvider` picks `DefaultAzureCredential` (production, resolves the Managed Identity) or `AzureCliCredential` (local dev, requires `az login`) based on `AZURE_AUTH_MODE`. `/sync` is synchronous and re-entrancy-locked in-memory (`SyncService`) — this is only correct because the Container App is pinned to `minReplicas=maxReplicas=1` in the Bicep template; don't scale it without revisiting that lock and the migration-on-boot strategy below.

**`src/costs/`** adds 4 more GET endpoints beyond that documented contract — `/costs/daily`, `/costs/accumulated`, `/costs/by-service`, `/costs/by-resource` — built ahead of real dashboard/frontend work, not yet reflected in `docs/byoc/connect-azure.md`. All route through `CostManagementService` (`src/azure/cost-management.service.ts`), which wraps Azure's single `client.query.usage()` SDK call with different `dataset.grouping`/`granularity` per view, plus an in-memory 30-minute cache (reported via an `X-Cache: HIT`/`MISS` response header — `main.ts`'s CORS config needs `exposedHeaders` for any new header like this to be readable by browser JS). `/costs/accumulated` makes **no Azure call of its own** — it's a derived running-sum transform of `/costs/daily`'s (cached) data, so the two endpoints share one cache entry. Two Azure-specific gotchas baked into `customDateRange()`: (1) Azure rejects a `to` timestamp containing today's exact time-of-day as "in the future" (same-day data isn't fully processed) — dates are normalized to UTC-midnight boundaries, never the literal current instant; (2) the Custom timeframe is inclusive on both ends, so "last N days" means `today - (N-1)`, not `today - N`. Cost Management's throttling (`429 Too many requests`) is scoped **per subscription being queried, not per calling identity** — confirmed empirically; switching Azure identities doesn't grant a fresh quota against the same subscription, so the cache (not identity-juggling) is the real mitigation. `local-dev-test/viewer/index.html` is a standalone, dependency-free HTML page for exercising these 4 endpoints outside the real frontend — serve via `npx http-server local-dev-test/viewer -p 5500` (requires `http://localhost:5500` present in `apps/api-byoc/.env`'s comma-separated `FRONTEND_ORIGIN`).

**`infra/bicep`** is deployed at resource-group scope (all the Azure Portal's "Deploy a custom template" flow allows), but the Reader + Cost Management Reader role assignments must be subscription-scoped — `modules/role-assignments.bicep` declares `targetScope = 'subscription'` and is invoked from `main.bicep` with an explicit `scope: subscription()`, a real Bicep feature (a module's scope can differ from its parent deployment's). Prisma migrations run from `apps/api-byoc/docker-entrypoint.sh` at container boot (`prisma migrate deploy`), not from CI — there is no pipeline that reaches into a customer's tenant.

**`apps/web`**'s `/connect-azure` page composes: a deploy-link button (built from `NEXT_PUBLIC_BICEP_TEMPLATE_URI`) → `PairingForm` (posts to `app/api/instance/route.ts`, which calls the paired backend's `/health` before persisting) → `OnboardingStepper` (discover/select/sync against `app/api/instance/subscriptions/route.ts` and `.../sync/route.ts`). All three of those route handlers are the *only* code allowed to read/write the pairing (`lib/clerk-org-metadata.ts`, marked `server-only`) or call the customer's backend (`lib/backend-client.ts`, also `server-only`) — client components only ever see a redacted `apiKeyLast4`. Note: `OnboardingStepper` collapses any non-OK response from these route handlers into a generic error ("Could not discover subscriptions", etc.) — the real cause (backend unreachable, Azure auth failure, whatever) is swallowed client-side; check `apps/api-byoc`'s own logs when diagnosing, not just the browser error text.

**`apps/web/app/dashboard`** is the ongoing product surface (as opposed to `/connect-azure`'s one-time onboarding), proxying `apps/api-byoc`'s 4 `/costs/*` endpoints through the same two-layer pattern as onboarding: `lib/backend-client.ts` methods → `app/api/instance/costs/{daily,accumulated,by-service,by-resource}/route.ts` (auth check → pairing lookup → backend call), never the customer's API key reaching the browser. `app/dashboard/layout.tsx` is shared chrome (nav, subscription switcher, period selector) around `page.tsx` (Overview: 3 KPI tiles + accumulated hero chart) and one detail page per view (`daily/`, `by-service/`, `by-resource/`). Two URL search params, not React state, drive filtering everywhere — `?subscriptionId=` and `?days=` — so every page is server-rendered/bookmarkable and filters persist across nav; `PeriodSelector`/`SubscriptionSwitcher` (`components/dashboard/`) just push new query strings. `SubscriptionSwitcher` deliberately filters the full Azure subscription list down to only `Instance.selectedSubscriptionIds` — `/costs/*` has no synced context for a subscription that was never selected during onboarding, so unselected ones aren't offered; if a customer paired more subscriptions than they see in the dropdown, that's this filter, not a bug — the fix is re-running subscription selection, not the component. The Overview page (`app/dashboard/page.tsx`) fetches `dailyCosts({ days: days * 2 })` once and derives both the prior-period delta and the accumulated/cumulative series from that single response client-side, rather than making 3 separate Azure-backed calls. Charting is Recharts (`^3.10.1`) — note its exported `Tooltip` is **not actually generic** despite `TooltipContentProps<Value,Name>` being a parameterizable type alias in the `.d.ts` files; `<Tooltip<number,string>>` JSX generic instantiation fails with "Expected 0 type arguments, but got 2". Use the unparameterized `TooltipContentProps` default and pass `content={(props) => <ChartTooltip {...props} .../>}` (a function, not a JSX element — Recharts clones tooltip props at runtime in a way static JSX typing can't verify), coercing `payload[0]?.value` (typed as the broad `ValueType`) with `Number(...)` where it feeds a `number`-typed formatter. Design tokens for charts live in a `.dashboard-root`-scoped CSS custom-property block in `globals.css` (light values + `@media (prefers-color-scheme: dark)` override, sourced from the `dataviz` skill's reference palette) — there is no manual theme toggle in this app, dark mode is OS-preference-only.

## SaaS tier — removed from working tree, preserved in git history

`apps/api-saas` is **not present in the codebase today.** It was scaffolded, then removed on 2026-08-07 while v1 focuses on finishing BYOC only — not abandoned, the code is fully recoverable from git history (checkpoint commit `335dde2`, before removal) and `docs/saas/plan/cloudguard-hosted.md` remains the source of truth for resuming it. Don't assume the directory exists; check history before referencing any file under it.

Summary of what existed at removal time, for whoever resumes this: a separate NestJS app, multi-tenant from the ground up (`Tenant` + `AzureConnection` Prisma models, no singleton-instance assumption like `apps/api-byoc`), with its own isolated Prisma client output (deliberately not the shared hoisted `node_modules/.prisma/client` `apps/api-byoc` uses, to prevent the two schemas from overwriting each other's generated client). `ClerkAuthGuard` verified the Clerk session JWT directly (no per-tenant API keys, unlike `apps/api-byoc`'s single global one — that pattern doesn't work once there's more than one tenant). Only `GET /health` was wired up; no connection flow, no cost endpoints, nothing reachable from `apps/web`.

**Row-Level Security was shipped and verified on `azure_connection`** (`enable_rls_azure_connection` migration) — the one piece of this tier that was genuinely done, not just scaffolded. The non-obvious part, worth knowing before resuming this schema: RLS is silently inert unless the connecting DB role lacks `BYPASSRLS`. Both the local Postgres bootstrap role *and* Neon's default `neon_superuser`-derived role have `BYPASSRLS` — so the app's runtime `DATABASE_URL` had to be a separately-created, restricted role (`local-dev-init.sql` set this up locally as `cloudguard_app`), while migrations used a different, elevated connection string via Prisma's `directUrl` (`MIGRATE_DATABASE_URL` in `.env`) — `prisma/schema.prisma`'s `datasource` block wired this split. Every tenant-scoped query went through `PrismaService.runInTenantContext()`, which set `app.tenant_id` transaction-locally (`set_config(..., true)`, never a bare `SET`, so it couldn't leak across a pooled connection).

## Commands

Monorepo (from repo root):

```
npm install                    # installs all workspaces
npm run dev:api                # apps/api-byoc in watch mode
npm run dev:web                # apps/web (Next.js dev server)
npm run build                  # packages/shared -> apps/api-byoc -> apps/web, in order
npm run build:shared           # packages/shared only (do this first if apps/* fail to resolve @cloudguard/shared)
```

`apps/api-byoc` (from `apps/api-byoc/`, or via `-w apps/api-byoc` from root):

```
docker compose -f docker-compose.dev.yml up -d postgres   # local Postgres
npx prisma generate --schema apps/api-byoc/prisma/schema.prisma
npm run prisma:migrate:dev -w apps/api-byoc           # creates/applies a migration against the local DB
npm run build -w apps/api-byoc                        # nest build
npm run start:dev -w apps/api-byoc                     # requires DATABASE_URL, API_KEY, AZURE_AUTH_MODE, FRONTEND_ORIGIN, PORT — see apps/api-byoc/.env.example
```

`apps/api-byoc` has **no `dotenv` loading of its own** — `nest start` does not read `.env` files automatically, so the env vars above must actually be present in the shell's environment, not just sitting in `apps/api-byoc/.env`. `local-dev-test/test-local-dev.ps1` handles this correctly (parses `apps/api-byoc/.env` and exports each value into the child process it spawns) — but running `npm run dev:api`/`npm run start:dev -w apps/api-byoc` directly in a fresh shell that hasn't sourced those vars will crash immediately with `PrismaClientInitializationError: Environment variable not found: DATABASE_URL`. That's an environment issue, not an application bug.

For real Azure calls locally, set `AZURE_AUTH_MODE=cli` and `az login` first — `DefaultAzureCredential` (the production path) only resolves inside a deployed Container App's Managed Identity. If `az login` sessions keep expiring every few hours (`AADSTS70043`), that's Conditional Access sign-in-frequency policy on a personal account, not a bug — `local-dev-test/ensure-az-login.ps1` logs in non-interactively via a Service Principal instead (only re-authenticates when the token has actually expired; real credentials live in the gitignored `local-dev-test/.env`, never committed). `local-dev-test/test-local-dev.ps1` chains that with the rest of the local startup sequence (Postgres, `apps/api-byoc`, `apps/web`, health check, opening the browser) — idempotent, skips anything already running.

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

An ARM/Bicep deployment `output` (the customer's API key, generated by `main.bicep`) is **not actually ephemeral** — it stays visible in the resource group's Deployment history to anyone with read access, despite `docs/byoc/connect-azure.md`'s "shown once" framing. This is a known, accepted v1 gap (see `infra/bicep/README.md`), not a bug to silently fix.
