# Finalize BYOC Flow — Local Verification, Then Real Azure Deployment

> Module: Core API — "Connect & Discover" (BYOC tier)
> Status: planning — the flow described in `docs/byoc/connect-azure.md` is
> already built end-to-end (see "What's already built" below); nothing
> here is new feature work. This doc tracks getting it *verified*, first
> against a local stack, then against a real Azure subscription, before
> calling v1 done.
> Companion docs: `docs/byoc/connect-azure.md` (the flow being verified, source
> of truth for behavior), `infra/bicep/README.md` (deploy mechanics),
> `README.md`'s "Restarting local dev" section (the exact local commands
> this plan's Phase 1 runs)

---

## Why this doc exists

Everything the BYOC tier needs has been built in isolation across several
sessions — `apps/api-byoc`'s 9 endpoints, `apps/web`'s onboarding + dashboard,
`infra/bicep`'s Deploy-to-Azure template — but no session has yet walked
the *entire* flow start to finish, either locally or against a real Azure
subscription. There is also no test runner in the repo (per `CLAUDE.md`),
so "it builds" has never meant "it works end-to-end." This plan is that
missing verification pass, in two phases: local first (fast iteration,
free), then real Azure (slow, costs money, but the only way to confirm the
Bicep template and Managed Identity actually work outside a Docker
container).

---

## What's already built (not in scope to build — only to verify)

| Piece | Where | Status |
|---|---|---|
| 5 documented endpoints (`/health`, `/subscriptions`, `/subscriptions/select`, `/status`, `/sync`) | `apps/api-byoc/src/{health,subscriptions,sync}` | Built |
| 4 cost endpoints (`/costs/daily`, `/costs/accumulated`, `/costs/by-service`, `/costs/by-resource`) | `apps/api-byoc/src/costs` | Built |
| Onboarding UI (deploy button → pairing form → discover/select/sync stepper) | `apps/web/app/connect-azure` | Built |
| Dashboard (Overview + 3 detail views, subscription switcher, period selector) | `apps/web/app/dashboard` | Built |
| Deploy-to-Azure template (Container App + Managed Identity + Postgres + role assignments) | `infra/bicep`, compiled to `main.json` | Built, **never run as a real `az deployment group create`** |
| Dev orchestration (local or Azure DB) | `dev-test/test-dev.ps1` | Built, not yet run through a full onboarding pass in this session |

---

## What's explicitly out of scope here

- **The SaaS tier** (`apps/api-saas`) — removed from the working tree, see
  `docs/saas/plan/cloudguard-hosted.md`. Not touched by this plan.
- **Manual-credential onboarding path** for BYOC (`ClientSecretCredential`,
  for customers self-hosting outside Azure-managed compute) — a real,
  separate feature, not yet specified. Tracked on its own, not part of
  finalizing the *existing* flow.
- **Deploying `apps/web` to Vercel** — the documented end-state has
  FinOps Lab hosting the frontend centrally, but that's a hosting task
  independent of whether the BYOC backend flow itself works. Noted as a
  stretch step at the end of Phase 2, not required to call this plan done.
- **The known, accepted API-key-not-ephemeral gap** (`infra/bicep/README.md`
  "Known v1 gap") — already decided, not re-litigated here.

---

## Phase 1 — Local end-to-end verification

Goal: run the *entire* onboarding + dashboard flow against a local stack
with real Azure Cost Management calls (`AZURE_AUTH_MODE=cli`), and fix
whatever breaks. This is the fast, free iteration loop before touching
real Azure infrastructure.

### Setup (one-time, skip if already done)
1. `npm install`, `npm run build:shared`
2. `cp apps/api-byoc/.env.example apps/api-byoc/.env` — fill in `API_KEY` (any value
   locally), confirm `AZURE_AUTH_MODE=cli`
3. `cp apps/web/.env.local.example apps/web/.env.local` — needs real Clerk
   keys; confirm Clerk Organizations is set up with "Membership required"
   and the session-token claim customization from `CLAUDE.md`'s Clerk
   setup gotcha
4. `docker compose -f docker-compose.dev.yml up -d` (just `postgres` now
   that `postgres-saas` is gone)
5. `npm run prisma:generate -w apps/api-byoc`, `npm run prisma:migrate:dev -w apps/api-byoc`
6. `az login` (or confirm `dev-test/.env` Service Principal creds are
   set up for `ensure-az-login.ps1`'s non-interactive path)

### Run
```powershell
.\dev-test\test-dev.ps1
```
Starts Postgres, `apps/api-byoc`, `apps/web`, waits for health, opens
`http://localhost:3000/connect-azure`.

### Verification checklist
- [ ] `GET /health` returns `{"status":"ok",...}` (script already checks this)
- [ ] Pairing form: enter Backend URL + API key, confirm it calls `/health`
  before persisting to Clerk org metadata
- [ ] Discover: `GET /subscriptions` returns real subscriptions visible to
  your `az login` identity
- [ ] Select: `POST /subscriptions/select` narrows to a chosen subset
- [ ] Sync: `POST /sync` completes without error; `GET /status` reflects
  `lastSyncedAt` updating
- [ ] Redirect to `/dashboard` with a "crunching your data" loading state,
  then real content
- [ ] Overview page: 3 KPI tiles + accumulated hero chart render with real
  numbers
- [ ] All 3 detail pages (`/dashboard/daily`, `/by-service`, `/by-resource`)
  render correctly for the selected subscription(s)
- [ ] `SubscriptionSwitcher` only offers subscriptions selected during
  onboarding (expected filter, not a bug — confirm it still behaves this
  way)
- [ ] `PeriodSelector` (`?days=`) changes reflect in the data without a
  full page reload breaking state
- [ ] `X-Cache` header flips `MISS` → `HIT` on a repeat request within the
  30-minute window (confirms `CostManagementService`'s cache is working)
- [ ] Error path: stop `apps/api-byoc`, confirm `apps/web` shows a generic but
  non-crashing error (per `CLAUDE.md`, the real cause is swallowed
  client-side — check `apps/api-byoc` logs to confirm *why* separately)
- [ ] Error path: wrong API key in the pairing form is rejected, not
  silently accepted

### Exit criteria for Phase 1
Every box above checked, or every failure has a linked fix committed.
Don't move to Phase 2 with a known-broken step in this list — a real Azure
deployment makes every iteration slower and costs money, so bugs are far
cheaper to catch here.

---

## Phase 2 — Real Azure deployment

Goal: confirm the Bicep template actually provisions a working instance in
a real subscription, and that the deployed instance behaves the same way
the local stack did in Phase 1. This is the only way to verify the parts
Phase 1 structurally cannot: Managed Identity resolution outside a
container that isn't running under `az login`, the role assignments
actually landing, and `docker-entrypoint.sh`'s `prisma migrate deploy` on
container boot.

### Steps
1. Rebuild the deploy artifact (skip if `infra/bicep` hasn't changed since
   last build):
   ```
   az bicep build --file infra/bicep/main.bicep --outfile infra/bicep/main.json
   ```
2. Push to `main` — the Deploy-to-Azure button and raw-URL validation both
   read from `github.com/satyamamin/CloudGuard@main`.
3. Structural validation (cheap, no resources created):
   ```
   az deployment group validate --resource-group <test-rg> --template-file infra/bicep/main.json
   ```
4. **Real deployment** — either:
   - Click the actual Deploy-to-Azure button from `apps/web`'s
     `/connect-azure` page (closest to what a real customer experiences), or
   - `az deployment group create --resource-group <test-rg> --template-file infra/bicep/main.json`
     directly (faster iteration if step 3 or earlier deploys fail)

   Use a real or dedicated test subscription with EU region options per
   `docs/byoc/connect-azure.md`'s deployment parameters.
5. Confirm provisioning:
   - [ ] Container App is running (check Container Apps logs for
     `Nest application successfully started`, confirming
     `prisma migrate deploy` succeeded on boot — there's no CI path that
     runs migrations, so this is the first real test of that entrypoint)
   - [ ] Postgres Flexible Server is reachable from the Container App
   - [ ] Managed Identity has **Reader** + **Cost Management Reader** at
     subscription scope (`az role assignment list --assignee <principal-id>`)
   - [ ] Deployment outputs include a Backend URL + API key
6. Pair `apps/web` (can stay running locally) against the *real* deployed
   Backend URL + API key — re-run the entire Phase 1 checklist against
   this real instance instead of localhost.
7. Confirm real cost data flows through — caveat: a fresh/low-usage test
   subscription may have sparse or no Cost Management data yet; Azure
   Cost Management data also lags (same-day data isn't fully processed,
   per the UTC-midnight-boundary gotcha in `CLAUDE.md`), so don't expect
   today's data to show up immediately.
8. Tear down the test resource group when done, unless keeping it running
   as a semi-permanent staging instance is useful going forward.

### Exit criteria for Phase 2
A real deployment, from a fresh resource group, reaches synced dashboard
data with no manual intervention beyond the documented onboarding steps
(deploy → pair → discover → select → sync). Any manual workaround needed
along the way is a bug, not a footnote.

---

## Stretch (not required to close this plan)

- Deploy `apps/web` to Vercel and re-run Phase 2 against the Vercel-hosted
  frontend instead of local — the actual intended v1 topology
  (`docs/byoc/connect-azure.md`), but a separate hosting concern from whether
  the backend flow itself works.
- Decide whether the test resource group from Phase 2 becomes a
  standing staging environment for future regression passes, or is
  torn down and re-created each time.

---

## Open items surfaced by this plan, not resolved by it

- No automated test runner exists anywhere in the repo — this plan is a
  manual verification pass, not a substitute for one. Worth revisiting
  once the flow is confirmed stable, so regressions in future changes
  don't require repeating this whole plan by hand.
- `infra/bicep/README.md`'s "Known v1 gap" (API key visible in deployment
  history) is unaffected by this plan — still an accepted gap, not a
  blocker to finalizing.
