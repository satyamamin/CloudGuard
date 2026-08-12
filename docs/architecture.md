# Architecture — Infrastructure Choices by Tier

> Module: Core Infrastructure
> Status: canonical reference — maps every infra layer to its per-tier
> choice; each row is marked with what's actually shipped vs. decided-but-
> not-yet-built, so this doc stays accurate as the SaaS tier gets built out
> Companion docs: `docs/byoc/connect-azure.md` (BYOC onboarding flow — customer's
> own Azure tenant), `docs/saas/plan/cloudguard-hosted.md` (SaaS tier architecture,
> decisions, and onboarding flow), `docs/byoc/plan/cost-management-429-resilience.md`
> (Phase 1/Phase 2 design for the Resilience row below)

---

## Why this doc exists

FinOps Lab ships two tiers on genuinely different infrastructure: BYOC
deploys into the customer's own Azure tenant (Container Apps, Azure
Postgres, Managed Identity); SaaS runs centrally on non-Azure infrastructure
(Railway, Neon) and reaches into customer tenants remotely. Each tier's
onboarding-flow doc describes its own architecture end-to-end, but neither
is the place to answer "what does the *other* tier use for this layer." This
doc is that single place — one table, one canonical answer per layer.

---

## Layer-by-layer

| Layer | SaaS tier | BYOC tier |
|---|---|---|
| Compute | Railway | Azure Container Apps |
| Database | Neon (Postgres) | Azure Database for PostgreSQL — Flexible Server |
| Cache | Upstash (Redis) | Azure Cache for Redis |
| Secrets | Env vars early → a secrets manager later | Azure Key Vault |
| Jobs | Trigger.dev | Trigger.dev |
| Auth | Clerk | Clerk |
| Resilience (Cost Management 429s) | N/A — no cost endpoints built yet | Catch-and-degrade at the API layer (clean `503` + Sentry alert), not a queue or retry system |

## Status per layer (what's actually true today)

The table above states the *decided* choice per layer. It does not mean
every cell is built and running — several are locked decisions for
infrastructure that doesn't exist yet, on both tiers. Read this section
before assuming a row is live.

| Layer | SaaS tier | BYOC tier |
|---|---|---|
| Compute | Decided, not deployed — `apps/api-saas` is scaffolded and runs locally; not yet deployed to Railway | **Shipped** — `infra/bicep` provisions a Container App with a system-assigned Managed Identity today |
| Database | Decided, not deployed — schema and migrations exist; local dev runs against a Postgres container standing in for Neon | **Shipped** — `infra/bicep` provisions Postgres Flexible Server today |
| Cache | Decided, not built (Phase 3 of the SaaS build) | **Decided, not shipped.** BYOC ships today with an in-memory `Map` cache in `CostManagementService` — safe only because Bicep pins `minReplicas=maxReplicas=1`. Azure Cache for Redis is a planned upgrade, not a running resource; nothing in `infra/bicep` provisions it yet |
| Secrets | Decided (env vars now, revisit at scale), not built | **Decided, not shipped.** No Key Vault exists in `infra/bicep` today — per `infra/bicep/README.md`, the deployment-output API key sits unencrypted in Container App config/deployment history, an accepted v1 gap. Key Vault is a stated future mitigation, not a running resource |
| Jobs | Decided, not built | **Decided, not shipped.** BYOC has no scheduler today — sync is a manual `POST /sync` call triggered by the frontend during onboarding. This was an open, undecided item in `connect-azure.md` ("Trigger.dev vs. an Azure Container Apps scheduled job"); `docs/saas/plan/cloudguard-hosted.md` resolves it as Trigger.dev, for both tiers, not yet implemented on either |
| Auth | **Shipped** — `apps/web` already uses Clerk, org-as-tenant, for the SaaS surface's auth | **Shipped** — same Clerk app, same org-as-tenant pattern, live in `apps/web` today |
| Resilience (Cost Management 429s) | N/A | **Decided, not shipped.** `docs/byoc/plan/cost-management-429-resilience.md`'s Phase 1 scopes the production fix (catch 429 → clean `503`, wider cache TTL via `COST_CACHE_TTL_MINUTES`, Sentry alert) — status "not started" as of this doc; Phase 2 (synced-history fallback) is deferred further still. Two *adjacent* things did ship in local dev, but neither is Phase 1's fix: (1) `CostManagementService.queryLast30DaysCost` (used by `/sync`) was missing the 30-min in-memory cache every other cost query already had, so repeated syncs re-hit an already-throttled subscription — now fixed to share the same cache; (2) a dev-only `USE_MOCK_COST_DATA=true` flag makes `/costs/daily`, `/costs/by-service`, `/costs/by-resource` (and derived `/costs/accumulated`) return canned fixtures instead of calling Azure at all, for UI iteration. Neither gives production customers a clean error or an alert — that's still the open gap this row tracks |

---

## Rationale per layer

**Compute — Railway vs. Container Apps.** BYOC's compute *must* be Azure
(it deploys into the customer's own tenant to use Managed Identity — the
entire point of that tier). SaaS's compute has no such constraint: its only
hard dependency on Azure is *calling* Azure's management APIs over REST, not
running inside Azure. Railway was chosen for the SaaS tier specifically to
avoid that constraint — see `docs/saas/plan/cloudguard-hosted.md` for the full
portability discussion.

**Database — Neon vs. Postgres Flexible Server.** Both are Postgres;
Prisma abstracts the difference at the application layer, so this is a
hosting choice, not an architecture one. BYOC's choice is fixed by "must
live inside the customer's Azure tenant." Neon was chosen for SaaS as a
managed, serverless-friendly Postgres that doesn't require running
infrastructure FinOps Lab has to patch.

**Cache — Upstash vs. Azure Cache for Redis.** Both tiers eventually need a
real cache once their in-memory-cache assumptions stop holding: BYOC's
current `Map` cache is safe only under a single-replica pin, and SaaS's
`apps/api-saas` (Phase 3, not yet built) can't safely use an in-memory cache
at all if Railway ever runs more than one replica — a per-replica cache
silently diverges. Upstash was chosen for SaaS as a serverless-friendly
managed Redis with no infrastructure to run; Azure Cache for Redis is the
natural equivalent for BYOC once it's needed, matching BYOC's "everything
lives in the customer's tenant" constraint.

**Secrets — env vars vs. Key Vault.** Neither tier has real secrets-manager
infrastructure today. BYOC's only real secret is its own DB connection
string plus the frontend-pairing API key; SaaS's one real secret is the
shared App Registration credential (`docs/saas/plan/cloudguard-hosted.md`'s
"Architecture (locked)" section) — a single, high-blast-radius credential
that makes a proper secrets manager more urgent for SaaS than an env var is
for BYOC's comparatively low-stakes DB string. Both start on env vars;
graduate to a secrets manager (Key Vault for BYOC, any standard secrets
manager for SaaS) before either needs to hold up under a real security
review.

**Jobs — Trigger.dev for both.** Originally an open question specific to
BYOC (`connect-azure.md`'s "Sync execution" open item asked whether an
Azure Container Apps scheduled job could replace an external job queue,
given BYOC's one-instance-per-customer shape). Resolved instead as
Trigger.dev for both tiers — SaaS's genuinely multi-tenant, potentially
multi-replica backend needs a real job queue regardless, and using the same
mechanism for BYOC avoids maintaining two different scheduling models for
what is, on both tiers, the same underlying "pull cost data on a schedule"
job.

**Auth — Clerk for both, already shipped.** Clerk organizations are the
tenant boundary for both tiers (`orgId` used throughout `apps/web`) — the
one layer where both tiers were always going to converge, since both are
served by the same centrally-hosted frontend.

**Resilience — catch-and-degrade, not a queue.** Azure Cost Management
throttles per subscription, not per caller (see the Cache rationale above),
so a 429 is an expected, recurring condition for any BYOC instance under
normal manual testing or a customer with several dashboard tabs open — not
a rare edge case worth a retry/backoff system. `docs/byoc/plan/cost-management-429-resilience.md`
covers both stages: Phase 2 there is the "solve it properly" answer
(scheduled sync, persisted history, fallback to synced data) but is
speculative engineering against a load pattern one early customer won't
generate. Phase 1 in that same doc scopes the cheap version instead: catch
the 429 at the API layer, return a clean customer-facing `503` instead of a
raw Azure error, widen the cache TTL for production (minutes → hours — cost
data already lags Azure-side, so this costs nothing in freshness), and fire
a Sentry warning so a real occurrence is visible without building any
alerting infrastructure. This is BYOC-only for now; SaaS has no cost
endpoints built yet for the question to apply to.

---

## Open items

- **Cache and Jobs are decided but unbuilt on both tiers** — until Redis and
  Trigger.dev actually exist, BYOC keeps running on its single-replica-safe
  in-memory cache and manual sync trigger; don't assume either row in the
  table above reflects running infrastructure.
- **Secrets manager choice for SaaS** is not yet named (Key Vault has no
  SaaS-side equivalent decided) — "any secrets manager" per
  `docs/saas/plan/cloudguard-hosted.md` is a placeholder, not a decision.
- This doc should be updated whenever a "not shipped" row above actually
  ships, so it doesn't drift the way a doc describing only intentions would.
- **Resilience is decided but not shipped** — `docs/byoc/plan/cost-management-429-resilience.md`'s
  Phase 1 (clean `503`, wider prod cache TTL, Sentry alert) is still "not
  started"; Phase 2 (synced-history fallback) is further deferred behind
  that. Don't confuse the dev-only `USE_MOCK_COST_DATA` fixture layer or the
  `queryLast30DaysCost` cache fix with Phase 1 being done — both are real
  but neither gives a production customer a clean error path.
