# Azure Cost Management endpoints — implemented vs. available

Reference doc: what CloudGuard's `apps/api-byoc` currently exposes for Cost Management data, versus the full surface Microsoft's `@azure/arm-costmanagement` SDK offers that hasn't been touched yet. All operation groups below are confirmed directly from the installed SDK (`node_modules/@azure/arm-costmanagement`), not from memory.

## Implemented in this project

All under `apps/api-byoc/src/costs/` (`CostsController` → `CostsService` → `CostManagementService`), all authenticated (`Authorization: Bearer <API_KEY>`), all backed by the single SDK operation `client.query.usage()` with different `dataset` parameters.

| Endpoint | Query params | Returns | Underlying Azure query |
|---|---|---|---|
| `GET /costs/daily` | `subscriptionId?`, `days?` (default 30) | `{currency, from, to, days: [{date, cost}]}` | `ActualCost`, daily granularity, no grouping |
| `GET /costs/accumulated` | `subscriptionId?`, `days?` | `{currency, from, to, days: [{date, cumulativeCost}]}` | **None** — derived from `/costs/daily`'s data, no extra Azure call |
| `GET /costs/by-service` | `subscriptionId?`, `days?` | `{currency, from, to, services: [{serviceName, cost}]}` (sorted desc) | `ActualCost`, grouped by `ServiceName` |
| `GET /costs/by-resource` | `subscriptionId?`, `days?` | `{currency, from, to, resources: [{resourceId, resourceName, cost}]}` (sorted desc) | `ActualCost`, grouped by `ResourceId` |

All four share a 30-minute in-memory cache in `CostManagementService` (`apps/api-byoc/src/azure/cost-management.service.ts`) and report `X-Cache: HIT`/`MISS` on the response. `subscriptionId` defaults to the backend's currently-selected subscription (`Instance.selectedSubscriptionIds[0]`) if omitted.

### Pre-existing, touches Cost Management indirectly

| Endpoint | Relation to Cost Management |
|---|---|
| `POST /sync` (`apps/api-byoc/src/sync/`) | Calls `CostManagementService.queryLast30DaysCost()` — a separate, lightweight "MonthToDate total" query, part of the documented 5-endpoint contract (`docs/byoc/connect-azure.md`), unrelated to the 4 endpoints above. |
| `GET /status` | Reads `Instance.lastSyncedAt`/`lastSyncError` from Postgres only — no Azure call. |

`GET /health`, `GET /subscriptions`, `POST /subscriptions/select` don't touch Cost Management at all.

## Available from Microsoft, not implemented

Every other operation group the SDK exposes (`node_modules/@azure/arm-costmanagement/dist/commonjs/classic/`):

| Operation group | What it does | Relevance to CloudGuard |
|---|---|---|
| **`forecast`** | Predicted future spend for a scope, based on historical trend | High — natural fifth view, same pattern as the four already built |
| **`budgets`** | Create/read/update/delete spending budgets (threshold + time period) with alerting | High — matches "Budget Alerts & Forecasting" in the original MVP scope (`docs/initial-vision-archive.md`) |
| **`alerts`** | List/dismiss cost alerts already triggered by Azure (budget overruns, anomalies, credit thresholds) | High — could drive "Cost Anomaly Detection" from the original MVP scope |
| **`generateCostDetailsReport`** | Async job generating a full itemized usage/cost detail file (replaces the old "Usage Details" API) — bulk historical export | High — worth reconsidering for `cost-management-429-resilience.md`'s Phase 2 12-month backfill instead of many small `query.usage` calls |
| **`dimensions`** | Lists valid values for a grouping dimension (e.g., all possible `ServiceName` values) at a scope | Medium — useful for building filter UIs |
| **`exports`** | Schedule recurring exports of cost data to a storage account (CSV) | Medium — alternative to polling for the sync direction |
| **`benefitRecommendations`** / **`benefitUtilizationSummaries`** | Reserved Instance / Savings Plan purchase recommendations and utilization tracking | Medium — matches "Reserved Instance marketplace comparison" in the original vision doc |
| **`priceSheet`** | Download the account's price list (unit prices per meter) | Low — mostly relevant to Enterprise Agreement/CSP scopes |
| **`views`** | Save/reuse named report configurations server-side (like the native portal's saved views) | Low |
| **`scheduledActions`** | Configure Azure to email a recurring report on a schedule | Low |
| **`costAllocationRules`** | Enterprise Agreement–only: rules to reallocate shared costs across cost centers | Not applicable — requires EA billing scope |
| **`settings`** | Cost Management's own internal configuration for a scope | Internal/administrative, not customer-facing |
| **`operations`** | Lists what operations this resource provider supports (metadata only) | Not applicable |

## Related, not yet built

See `docs/byoc/plan/cost-management-429-resilience.md`'s Phase 2 — scheduled daily sync + 12-month persisted history in Postgres, to survive Cost Management's rate-limit throttling. Worth revisiting that plan's backfill approach against `generateCostDetailsReport` above before implementing.
