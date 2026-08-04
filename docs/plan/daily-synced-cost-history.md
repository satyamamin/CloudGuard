# Daily-synced cost history to survive Azure Cost Management rate limits

> **Status: not started.** Saved for future reference — pick this up whenever ready to build it.

## Context

`GET /costs/daily` and `GET /costs/by-service` call Azure Cost Management live on every request. Azure's Cost Management Query API throttling is scoped to the **subscription being queried**, not the calling identity (confirmed empirically — switching `az login` to a Service Principal didn't grant a fresh quota against the same subscriptions), so repeated testing across subscriptions reliably produces `429 Too many requests`. A 30-minute in-memory cache in `CostManagementService` already helps for *repeated identical* queries, but doesn't help for the first hit on a new subscription/range, or once the quota's genuinely exhausted for the window.

This also isn't purely a testing convenience — `docs/connect-azure.md`'s "Open items" section already flags this exact direction as deferred v1 work: *"an Azure Container Apps scheduled job (cron) inside the same deployment"* to replace ad-hoc syncing, and a "deferred TimescaleDB ingestion schema" for persisted daily cost rows (referenced in `cost-management.service.ts`'s existing top-of-file comment). This plan is a first cut at both.

**Agreed behavior:** the live endpoints stay live-first (freshest data by default). Only when a live call hits `429` does the endpoint fall back to whatever's been synced to Postgres for that subscription/range. If the synced fallback also has no data for the requested range (e.g., backfill hasn't reached it yet), the endpoint returns a clear, specific error naming the real cause (Azure's quota limit) rather than a generic 429 passthrough.

## Approach

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

Daily costs = `groupBy(['date'], sum(cost))`; cost-by-service = `groupBy(['serviceName'], sum(cost))` — both derivable from this one table via Prisma aggregation, no separate storage needed. This also sets up "Accumulated costs" (the third planned view) as a trivial follow-up: a running `SUM` over the same rows.

### 2. Generalize `CostManagementService` to take an explicit date range

Today, `queryDailyCosts`/`queryCostByService` only support "last N days ending today" via the internal `customDateRange(days)` helper (`apps/api/src/azure/cost-management.service.ts`). The sync job needs to fetch **arbitrary historical days/months** (yesterday, and whichever old month is next to backfill), so both methods need an explicit `{from, to}` variant alongside the existing `days`-based one used by the live endpoints. Reuse the existing column-lookup helpers (`findColumnIndex`, `formatUsageDate`) unchanged — only the date-range construction needs to stop being "always relative to today."

### 3. New scheduled sync job (`@nestjs/schedule`, not yet a dependency — needs adding)

New `CostSyncService` in `apps/api/src/costs/` (or a new `costs-sync/` submodule), registered with `@Cron` (once daily, e.g. early morning UTC). For each `instance.selectedSubscriptionIds` (reuse `InstanceService.getOrCreate()`, same pattern as the existing `SyncService`):

1. **Daily increment:** fetch yesterday's per-service costs (single-day range) and upsert into `DailyServiceCost` (`@@unique` on subscription+date+service makes this idempotent).
2. **Gradual backfill:** find the oldest `date` already stored for that subscription (or "no data yet" → start from yesterday going backward); if fewer than 12 months of history exist, fetch and upsert **one additional month** per run — so a fresh subscription is fully backfilled to 12 months over ~12 daily runs, never a large burst of calls.

This is deliberately a **separate** mechanism from the existing `SyncService`/`POST /sync` (`apps/api/src/sync/`) — that endpoint is part of the documented 5-endpoint contract with its own meaning (manual, lightweight, user-triggered during onboarding); this is an internal scheduled job with no HTTP-facing contract change.

### 4. Live-first-with-fallback in the endpoints

`CostsService.getDailyCosts`/`getCostByService` (`apps/api/src/costs/costs.service.ts`):
1. Try the existing live `CostManagementService` call (cache still applies).
2. On a caught 429 (`RestError` with `statusCode === 429`, matching what's already visible in the Nest console logs), query `DailyServiceCost` via Prisma for the same subscription + date range and aggregate the same way.
3. If that fallback query returns zero rows for the requested range, throw a specific error (e.g. a custom exception mapped to a clear message like `"Azure Cost Management's API quota limit was reached, and no synced historical data is available yet for this period."`) instead of letting the raw Azure 429 bubble up.

Reuse the existing `X-Cache` header pattern (`costs.controller.ts`) to also add a parallel `X-Data-Source: live | synced-fallback` header, so the viewer (and you, testing) can see at a glance which path served a given response — same mechanism, no schema changes.

## Critical files

- `apps/api/prisma/schema.prisma` — new `DailyServiceCost` model (+ migration)
- `apps/api/src/azure/cost-management.service.ts` — generalize date-range construction; add explicit-range query variants
- `apps/api/src/costs/costs.service.ts` — live-then-fallback logic
- `apps/api/src/costs/costs.controller.ts` — `X-Data-Source` header
- New: `apps/api/src/costs/cost-sync.service.ts` (or similar) — the `@Cron` job
- `apps/api/src/costs/costs.module.ts` — register the new sync service/schedule module
- `apps/api/package.json` — add `@nestjs/schedule`
- `local-dev-test/viewer/index.html` — read/display `X-Data-Source`, matching the existing `X-Cache` badge
- `docs/connect-azure.md` — update the "Open items" bullet now that a first cut of the scheduled-sync direction exists

## Verification (once built)

- Apply the new migration locally; confirm `daily_service_cost` table exists (`docker exec cloudguard-postgres-1 psql ...`, same pattern used earlier this session).
- Manually trigger the sync logic once (temporarily callable outside the cron schedule, or just wait for/force the first tick) against a selected subscription; confirm rows land in Postgres with correct date/service/cost/currency.
- Hit `/costs/daily` and `/costs/by-service` normally — confirm `X-Data-Source: live` and identical behavior to today.
- Force a 429 (repeat rapid requests across several subscriptions, as already reliably reproducible this session) — confirm the response falls back to synced data with `X-Data-Source: synced-fallback` for a subscription that has synced history, and confirm the clear quota-limit error message (not a raw 429 dump) for one that doesn't yet.
