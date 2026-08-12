# Cost Management 429 Resilience — Guardrail Now, Synced History Later

> **Status: not started** (both phases). Merges what were two separate docs
> (`lightweight-429-guardrail.md`, `daily-synced-cost-history.md`) into one,
> since they're two stages of the same problem, not two different problems.
> Companion docs: `docs/architecture.md` (canonical Resilience row —
> keep in sync with whichever phase below actually ships),
> `docs/byoc/azure-cost-management-endpoints.md` (the `generateCostDetailsReport`
> API worth reconsidering for Phase 2's backfill instead of many small
> `query.usage` calls)

---

## Why one doc, not two

`GET /costs/daily` and `GET /costs/by-service` call Azure Cost Management
live on every request. Azure's Cost Management Query API throttling is
scoped to the **subscription being queried**, not the calling identity
(confirmed empirically — switching identities doesn't grant a fresh quota
against the same subscription). A cache in `CostManagementService`
(`apps/api-byoc/src/azure/cost-management.service.ts`, currently `COST_CACHE_TTL_MINUTES`,
default 4h) already helps for *repeated identical* queries, but doesn't help
for the first hit on a new subscription/range, or once the quota's genuinely
exhausted for the window — `429 Too many requests` is a real, expected,
recurring condition, not a rare edge case.

There are two honest answers to "what do we do about that," at two very
different costs, and they were originally written up as separate docs. They
belong in one place because **Phase 2 is what Phase 1 explicitly defers**,
not an independent initiative:

- **Phase 1 — lightweight guardrail** (~half a day): stop a 429 from
  surfacing as a raw, ugly error to a customer. Scoped as the minimal
  pre-customer-1 fix.
- **Phase 2 — daily-synced cost history**: solve it properly with a
  scheduled sync job and persisted history in Postgres, so live calls have a
  real fallback instead of just a clean error message. Deliberately
  speculative engineering *until* there's a concrete signal it's needed —
  see "When to promote Phase 1 → Phase 2" below.

Keep this file as the single source of truth for both; don't let a future
edit to one phase drift out of sync with the other by living in separate
docs again.

---

## Phase 1 — Lightweight guardrail (pre-launch)

Goal: close the "customer sees a raw 429" gap cheaply, without building
Phase 2's infrastructure early.

### 1. Catch 429 and return a clean, customer-facing error

`CostsService.getDailyCosts` / `getCostByService` (`apps/api-byoc/src/costs/costs.service.ts`)
already call `CostManagementService`. Wrap the call:

- Catch `RestError` where `statusCode === 429`.
- Throw a custom exception (e.g. `AzureQuotaExceededException`) mapped via a
  Nest exception filter to a clean HTTP response:
  ```json
  {
    "statusCode": 503,
    "message": "Cost data is temporarily unavailable while we refresh from Azure. Please try again in a few minutes."
  }
  ```
- Use `503` (service temporarily unavailable), not a passthrough `429` — it's
  more accurate for the customer's context (it's *your* dependency that's
  throttled, not their client).
- Frontend: catch this response shape in the dashboard fetch logic and show
  a friendly inline message/toast instead of a broken chart or raw error
  dump.

### 2. Cache TTL is already configurable — confirm it stays that way

`COST_CACHE_TTL_MINUTES` (`apps/api-byoc/.env`, read in `cost-management.service.ts`)
already exists and defaults to 4h in production-shaped local testing —this
part of the original Phase 1 scope is **done**, not just planned. Nothing
further needed here beyond keeping it env-driven rather than re-hardcoding
it if the code around it changes.

### 3. Alert yourself when a 429 actually happens

- You already have Sentry in the stack — use it.
- In the same catch block from step 1, fire a Sentry event (warning-level,
  not error-level, since it's expected/handled) tagged with
  `azureSubscriptionId` and the endpoint hit.
- This converts "customer silently sees a degraded experience" into "you get
  pinged and can follow up," without building any dashboard or alerting
  infrastructure.

### Phase 1 critical files

- `apps/api-byoc/src/costs/costs.service.ts` — catch 429, throw custom exception
- New or existing exception filter (`apps/api-byoc/src/common/filters/` or
  similar) — map `AzureQuotaExceededException` → clean `503` response
- Frontend cost dashboard fetch logic (wherever `/costs/daily` /
  `/costs/by-service` are called) — handle the clean error shape gracefully
- Sentry init/config (wherever already set up) — confirm warning-level
  events are captured, not filtered out

### Phase 1 verification (once built)

- Force a 429 locally (rapid requests across several subscriptions).
- Confirm the API returns the clean `503` message, not a raw Azure 429 dump.
- Confirm a Sentry warning event fires with the right subscription/endpoint
  tags.
- Confirm the frontend shows a friendly message instead of a broken chart.
- Confirm normal (non-adversarial) manual testing no longer trips 429 within
  1-2 clicks, given the cache TTL already in place.

---

## Phase 2 — Daily-synced cost history (deferred)

Goal: give the live endpoints a real fallback — persisted history in
Postgres — instead of just a clean error when Azure throttles. Deliberately
**not started** until there's a concrete signal (see below); this section
exists so the design doesn't have to be re-derived when that signal shows
up.

This also isn't purely a resilience nice-to-have — `docs/byoc/connect-azure.md`'s
"Open items" section already flags this exact direction as deferred v1
work: *"an Azure Container Apps scheduled job (cron) inside the same
deployment"* to replace ad-hoc syncing, and a "deferred TimescaleDB
ingestion schema" for persisted daily cost rows (referenced in
`cost-management.service.ts`'s top-of-file comment).

**Agreed behavior:** the live endpoints stay live-first (freshest data by
default). Only when a live call hits `429` does the endpoint fall back to
whatever's been synced to Postgres for that subscription/range. If the
synced fallback also has no data for the requested range (e.g. backfill
hasn't reached it yet), the endpoint returns a clear, specific error naming
the real cause (Azure's quota limit) rather than a generic 429 passthrough
— i.e. Phase 1's clean-error behavior becomes the *last-resort* fallback
under Phase 2, not replaced by it.

### 1. New Prisma model — one table serves both views

```prisma
model DailyServiceCost {
  id                  String   @id @default(cuid())
  azureSubscriptionId String
  date                String   // YYYY-MM-DD (UTC), matches customDateRange's fromIso/toIso format
  serviceName         String
  cost                Float
  currency            String
  createdAt           DateTime @default(now())

  @@unique([azureSubscriptionId, date, serviceName])
  @@index([azureSubscriptionId, date])
  @@map("daily_service_cost")
}
```

Daily costs = `groupBy(['date'], sum(cost))`; cost-by-service =
`groupBy(['serviceName'], sum(cost))` — both derivable from this one table
via Prisma aggregation, no separate storage needed. This also sets up
"Accumulated costs" (the third planned view) as a trivial follow-up: a
running `SUM` over the same rows.

### 2. Generalize `CostManagementService` to take an explicit date range

Today, `queryDailyCosts`/`queryCostByService` only support "last N days
ending today" via the internal `customDateRange(days)` helper
(`apps/api-byoc/src/azure/cost-management.service.ts`). The sync job needs to
fetch **arbitrary historical days/months** (yesterday, and whichever old
month is next to backfill), so both methods need an explicit `{from, to}`
variant alongside the existing `days`-based one used by the live endpoints.
Reuse the existing column-lookup helpers (`findColumnIndex`,
`formatUsageDate`) unchanged — only the date-range construction needs to
stop being "always relative to today."

### 3. New scheduled sync job (`@nestjs/schedule`, not yet a dependency — needs adding)

New `CostSyncService` in `apps/api-byoc/src/costs/` (or a new `costs-sync/`
submodule), registered with `@Cron` (once daily, e.g. early morning UTC).
For each `instance.selectedSubscriptionIds` (reuse
`InstanceService.getOrCreate()`, same pattern as the existing
`SyncService`):

1. **Daily increment:** fetch yesterday's per-service costs (single-day
   range) and upsert into `DailyServiceCost` (`@@unique` on
   subscription+date+service makes this idempotent).
2. **Gradual backfill:** find the oldest `date` already stored for that
   subscription (or "no data yet" → start from yesterday going backward); if
   fewer than 12 months of history exist, fetch and upsert **one additional
   month** per run — so a fresh subscription is fully backfilled to 12
   months over ~12 daily runs, never a large burst of calls.

This is deliberately a **separate** mechanism from the existing
`SyncService`/`POST /sync` (`apps/api-byoc/src/sync/`) — that endpoint is part of
the documented 5-endpoint contract with its own meaning (manual,
lightweight, user-triggered during onboarding); this is an internal
scheduled job with no HTTP-facing contract change.

### 4. Live-first-with-fallback in the endpoints

`CostsService.getDailyCosts`/`getCostByService`
(`apps/api-byoc/src/costs/costs.service.ts`):

1. Try the existing live `CostManagementService` call (cache still
   applies).
2. On a caught 429 — the same catch point Phase 1 already added — query
   `DailyServiceCost` via Prisma for the same subscription + date range and
   aggregate the same way, instead of immediately returning Phase 1's clean
   `503`.
3. If that fallback query returns zero rows for the requested range, *then*
   fall through to Phase 1's clean error (naming Azure's quota limit as the
   cause) rather than letting the raw Azure 429 bubble up.

Reuse the existing `X-Cache` header pattern (`costs.controller.ts`) to also
add a parallel `X-Data-Source: live | synced-fallback` header, so the
viewer (and you, testing) can see at a glance which path served a given
response — same mechanism, no schema changes.

### Phase 2 critical files

- `apps/api-byoc/prisma/schema.prisma` — new `DailyServiceCost` model (+
  migration)
- `apps/api-byoc/src/azure/cost-management.service.ts` — generalize date-range
  construction; add explicit-range query variants
- `apps/api-byoc/src/costs/costs.service.ts` — live-then-fallback logic, layered
  on top of Phase 1's catch block
- `apps/api-byoc/src/costs/costs.controller.ts` — `X-Data-Source` header
- New: `apps/api-byoc/src/costs/cost-sync.service.ts` (or similar) — the `@Cron`
  job
- `apps/api-byoc/src/costs/costs.module.ts` — register the new sync
  service/schedule module
- `apps/api-byoc/package.json` — add `@nestjs/schedule`
- `local-dev-test/viewer/index.html` — read/display `X-Data-Source`,
  matching the existing `X-Cache` badge
- `docs/byoc/connect-azure.md` — update the "Open items" bullet now that a first
  cut of the scheduled-sync direction exists

### Phase 2 verification (once built)

- Apply the new migration locally; confirm `daily_service_cost` table
  exists.
- Manually trigger the sync logic once (temporarily callable outside the
  cron schedule, or just wait for/force the first tick) against a selected
  subscription; confirm rows land in Postgres with correct
  date/service/cost/currency.
- Hit `/costs/daily` and `/costs/by-service` normally — confirm
  `X-Data-Source: live` and identical behavior to today.
- Force a 429 — confirm the response falls back to synced data with
  `X-Data-Source: synced-fallback` for a subscription that has synced
  history, and confirm Phase 1's clear quota-limit error message (not a raw
  429 dump) for one that doesn't yet.

---

## When to promote Phase 1 → Phase 2

Don't start Phase 2 speculatively. Revisit it once there's a concrete
signal instead:

- Real 429s showing up in Sentry (Phase 1's alert) against **production**
  traffic, not just local/manual testing.
- Enough customers/subscriptions that combined polling could plausibly
  exhaust quota even with Phase 1's cache TTL in place.

## Out of scope for both phases

- Any actual retry/backoff/queueing system for Azure calls — Phase 1 is
  catch-and-degrade, not a queue (see `docs/architecture.md`'s
  Resilience rationale for why).
- SaaS-tier equivalent — `apps/api-saas` has no cost endpoints built yet for
  this to apply to.
