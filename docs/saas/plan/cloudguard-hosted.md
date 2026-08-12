# CloudGuard Hosted (SaaS Tier) — Architecture & Onboarding Flow (v1)

> Module: Core API — "Connect & Discover" (SaaS tier)
> Status: **deferred — not in v1 scope.** Architecture decisions below are
> locked for whenever this tier is picked back up, but initial shipping
> (2026-08-06 decision) is BYOC-only, using the already-built
> `docs/connect-azure.md` flow exclusively. `apps/api-saas` (health endpoint
> running, RLS shipped and verified on `azure_connection`, connection/cost
> endpoints not started) was removed from the working tree — not
> abandoned, just not carried forward as dead code while v1 focuses on
> BYOC. The code is preserved in git history at commit `335dde2` and this
> doc remains the source of truth for resuming it. Revisit after initial
> customer traction.
> Companion docs: `docs/connect-azure.md` (BYOC/self-hosted tier — the tier
> that actually ships first; unaffected by this doc),
> `docs/plan/architecture.md` (canonical per-layer infra choice + build status
> across both tiers)

---

## Offering model: one product, two deployment modes

Same codebase, same features, same pricing logic. The only difference is
where the backend and database live.

| | SaaS tier (default) | BYOC tier (enterprise) |
|---|---|---|
| Backend + DB location | Shared, multi-tenant, hosted centrally | Customer's own Azure tenant |
| Onboarding | Self-serve signup, OAuth/delegation consent | "Deploy to Azure" button |
| Who maintains it | Central team (auto-updates) | Customer (manual redeploy on updates) |
| Sell it on | Speed, zero setup, low price | Data never leaves their tenant — GDPR/security review pass |
| Who buys it | Most customers, especially early on | Security-conscious enterprise buyers |

BYOC doesn't need to be built before there's demand for it — it's an
objection-handler for security review, not a launch requirement. Build SaaS
first.

---

## Why a second tier, and why this reopens a decision `connect-azure.md` made

`docs/connect-azure.md`'s "Architecture pivot" section records CloudGuard
deliberately abandoning a shared multi-tenant backend + per-customer Service
Principal ("v0") in favor of a customer-hosted, single-tenant backend ("v1")
— specifically for the GDPR/EU-data-residency pitch: *"customer data never
leaves their own tenant, because there's no central database to leave it
in."*

The SaaS tier reintroduces the v0 shape on purpose, as a second, parallel
option — not a replacement. Some customers want zero infrastructure to
manage and are willing to trade the "no central database" pitch for
speed-to-value; others want the BYOC tier's stronger residency story and are
willing to run their own deployment for it. Both are sold as distinct
options. **The BYOC tier (`apps/api`, `infra/bicep`, `app/connect-azure`) is
completely unaffected by this doc — it ships today, unchanged.**

---

## What "multi-tenant" means here

One shared backend (`apps/api-saas`) + one shared database (Neon), serving
all customers at once — as opposed to each customer getting a dedicated
deployment (that's BYOC).

- Each row is tagged with a `tenantId`.
- Every query is scoped by `tenantId`, enforced two ways: app-level
  (`ClerkAuthGuard` resolves `tenantId` from the verified session JWT; every
  Prisma query runs through `PrismaService.runInTenantContext`) and,
  **shipped**, Postgres Row-Level Security on `azure_connection`
  (`enable_rls_azure_connection` migration) as the DB-enforced backstop —
  fails closed if the app-level filter is ever missing.
- Isolation is **logical** (tenantId-scoped, RLS-backed) in the SaaS tier,
  vs. **physical** (separate deployment) in BYOC.

**A gotcha this surfaced, critical for Step 5 (Neon setup):** RLS is only a
real backstop if the app's DB role lacks `BYPASSRLS`. Neon's default role
(`neon_superuser`, which every role created via the Neon console/API/CLI
inherits) has included `BYPASSRLS` since August 2023 — using Neon's default
connection string would make this policy silently inert, the same trap the
local dev Postgres container hit with its bootstrap superuser role. The
production Neon project needs a **separate, restricted role** (no
`neon_superuser` membership) for the app's runtime `DATABASE_URL`, distinct
from the elevated role migrations use (`MIGRATE_DATABASE_URL` /
`directUrl` in `prisma/schema.prisma`) — mirroring
`apps/api-saas/local-dev-init.sql`'s local setup exactly.

Tradeoffs:
- Cheaper and simpler to operate at scale (one DB to patch/monitor vs. N).
- Carries real engineering risk: a bug in RLS policies, or a missing
  `tenantId` filter in application code, is a cross-tenant data leak. BYOC
  sidesteps this category of bug entirely by construction.

---

## Hosting: infrastructure choices

The backend's only hard dependency on Azure is *calling* Azure's management
APIs (Cost Management, Resource Graph, Advisor) over REST — it doesn't need
to physically run in Azure. `apps/api-saas` runs on **Railway** (compute)
with **Neon** (managed Postgres, EU region) — not deployed into any
customer's Azure tenant, unlike BYOC. It reaches *out* to each customer's
Azure tenant remotely.

| Layer | Azure-specific option | Portable alternative | Switching cost |
|---|---|---|---|
| Compute | Azure Container Apps | Any Docker host — Fargate, Cloud Run, Fly.io, Railway | Low — just a container, no Azure API calls in app code |
| Database | Postgres Flexible Server | Any managed Postgres — RDS, Cloud SQL, Neon, Supabase | Low — Prisma abstracts the SQL layer |
| Cache | Azure Cache for Redis | Any managed Redis — ElastiCache, Upstash, Redis Cloud | Low — Redis is Redis |
| Secrets | Azure Key Vault | Any secrets manager, or env vars early on | Low if not deep into Key Vault SDK calls yet |
| Auth | Clerk | Already cloud-agnostic | None |
| Jobs | Trigger.dev vs. ACA scheduled cron | Trigger.dev is cloud-agnostic | **Decision: use Trigger.dev**, not ACA cron |

**Decision:** favor cloud-portable choices for everything except the Azure
SDK cost-management integration layer itself (inherently Azure-specific,
since reading Azure cost data is the product). Keep infra code
(Bicep/Terraform) separate from application code, and keep Azure SDK calls
confined to a dedicated integration module. This gets ~90% of the
portability benefit for near-zero extra effort — no need to over-invest in
full cloud-agnosticism (e.g. Terraform/k8s from day one) speculatively.

The frontend is the same centrally-hosted Next.js app (`apps/web`) BYOC
already uses — Clerk organizations are the tenant boundary for both tiers.
What differs is which backend an org's dashboard talks to, and how that
backend authenticates to Azure.

**Rough early-stage Azure hosting cost** (if staying on Azure, low traffic,
first handful of customers): roughly €40–90/month — Container Apps
consumption plan (scale-to-zero, largely covered by free tier at this
scale), Postgres Burstable B1ms (~$12–20/mo), Redis Basic C0 (~$15/mo,
dev-grade/no SLA — upgrade to Standard before depending on uptime), plus
small Key Vault/registry costs.

See `docs/plan/architecture.md` for the canonical, cross-tier table of what's
actually shipped vs. decided-but-not-built per layer — this section is the
rationale, that doc is the live status.

---

## Cross-tenant access mechanism

Question: how should the shared SaaS backend read cost data from each
customer's Azure tenant without deploying anything into it?

**Option A — Azure Lighthouse delegation**
Customer runs a small ARM template delegating Reader + Cost Management
Reader to a CloudGuard-owned identity. No secret is ever stored or
transmitted.
- \+ No stored credential — eliminates leak/rotation risk entirely.
- \+ Strongest story for security-conscious/enterprise buyers; consistent
  with BYOC's no-stored-secrets posture.
- \+ Customer can revoke access anytime from their own Azure Portal.
- – Still requires an ARM deployment step for onboarding (not pure
  OAuth-click).
- – Less commonly documented; more engineering time to get right
  (cross-tenant Resource Graph/Cost Management querying has quirks).
- – Weaker "2-minute self-serve signup" experience.

**Option B — Multi-tenant App Registration + stored client secret**
Customer does one-click OAuth admin-consent against a CloudGuard-owned
multi-tenant AAD app; CloudGuard authenticates with one shared credential
across every tenant (see "Architecture" below — this is not a secret stored
per customer).
- \+ Fast to build — standard, extremely well-documented OAuth pattern.
- \+ Smoothest onboarding UX (click, consent, done).
- – CloudGuard now holds one live, rotatable credential whose compromise
  affects every tenant at once — the exact category of risk BYOC's
  Managed Identity model was chosen to avoid entirely.
- – Real ongoing operational burden: rotation policy, secure storage.
- – Weaker story in a security review than BYOC's zero-stored-secret model.

**Decision: Option B, final.** Not a beta-phase stopgap; no planned
migration to Option A (Lighthouse). If a specific prospect's
security/procurement review can't accept a stored credential, handle it as
a case-by-case enterprise exception rather than replacing the default
mechanism.

### Architecture (locked)

**One CloudGuard-owned credential, not one per customer.** A common
misreading of the App-Registration pattern is that CloudGuard would store a
distinct credential per tenant, mirroring the original v0 design's "customer
pastes Tenant ID / Client ID / Secret" form. That's not how a multi-tenant
app registration works: CloudGuard registers **one** Azure AD app as
multi-tenant ("accounts in any organizational directory"), in its own
tenant, with **one** credential — a certificate, not a client secret
(Microsoft's recommended credential for this pattern, and meaningfully
harder to exfiltrate / easier to rotate than a shared string). That one
credential is stored once, as a Railway environment variable — never in
Neon, never per-tenant, never alongside tenant data.

Per customer, two things happen, neither of which hands CloudGuard a new
credential:

1. **Admin consent** — the customer's Azure AD admin visits a standard
   consent URL
   (`https://login.microsoftonline.com/{customer_tenant_id}/adminconsent?client_id={cloudguard_app_id}&redirect_uri=...`).
   This provisions a service-principal object for CloudGuard's app *inside
   the customer's tenant* — an OAuth redirect and one click, no secret
   exchanged.
2. **RBAC role assignment** — consent alone grants no ARM access. The
   customer separately assigns **Reader + Cost Management Reader** (the
   same two roles BYOC's Managed Identity gets, via
   `infra/bicep/modules/role-assignments.bicep`) to that service principal,
   scoped to their subscription(s) — a small, separate ARM/Bicep template
   deployment (`infra/saas-role-assignment/`), using the same "Deploy to
   Azure" portal-link UX as BYOC's button but provisioning nothing except
   two `Microsoft.Authorization/roleAssignments` resources — no compute, no
   database.

At query time, `apps/api-saas` builds
`ClientSecretCredential(customerTenantId, AZURE_SAAS_CLIENT_ID, AZURE_SAAS_CLIENT_CERT)`
per connection — the client ID and credential are always the same; only the
customer's tenant ID varies. The database stores, per connection: the
customer's Azure tenant ID, consent/role-assignment confirmation state, and
selected subscription IDs. **No secret or credential column exists in the
schema** — there is nothing customer-specific to encrypt at rest, rotate
per-tenant, or leak per-tenant.

**The honest tradeoff, stated plainly:** this is a materially different
security posture than BYOC's Managed Identity model, where no CloudGuard-side
secret exists at all. Here, one compromised CloudGuard-owned credential is a
blast radius across *every* connected customer tenant at once — the inverse
of BYOC's per-customer physical isolation, and the direct cost of choosing
Option B as final. Mitigations, non-negotiable from day one:

- Use a **certificate**, not a client secret.
- Store it only as a Railway environment variable — **never** in Neon.
- Write a credential-rotation runbook now, even though rotation isn't
  needed on day one — rotating a single shared credential across all
  tenants under incident pressure is not something to design for the first
  time during an actual incident.

### Data residency

Neon is a real, central, multi-tenant database — BYOC's "no data leaves the
tenant" pitch does not apply to the SaaS tier, and this doc says so
directly rather than implying otherwise. What's actually stored is
connection *metadata*: the customer's Azure tenant ID, consent/role-assignment
status, and selected subscription IDs — no line-item cost data is persisted
long-term, matching `apps/api`'s existing "query live, cache short-TTL,
don't ingest line items" approach. The Neon project is pinned to an **EU
region**, keeping at least the metadata consistent with BYOC's EU-residency
framing, even though the "no central database" claim itself no longer holds
for this tier.

---

## What changes for the customer (vs. BYOC)

No Bicep deployment, no Container App, no Postgres to provision, no Backend
URL/API key to copy-paste. Two clicks instead: admin consent, then a small
role-assignment template deployment.

## What changes for the backend (vs. BYOC)

`apps/api-saas` is genuinely multi-tenant — a `Tenant` row per Clerk
organization, an `AzureConnection` row per delegated Azure tenant. Auth is a
verified Clerk session JWT (the caller is always CloudGuard's own frontend,
acting on behalf of a logged-in org), not BYOC's single global API key —
one shared key across all tenants would defeat per-tenant isolation
entirely.

---

## Onboarding sequence

```
Click "Connect Azure" (on /connect-cloud, not /connect-azure)
  → Admin-consent redirect (login.microsoftonline.com/{tenant}/adminconsent)
       → customer's AAD admin approves → CloudGuard's SP now exists in their tenant
  → "Grant access" — small ARM/Bicep template deploy link
       → grants Reader + Cost Management Reader on the chosen subscription(s)
         to CloudGuard's SP
  → Status poller confirms role assignment (ConnectionStatus → ACTIVE)
  → Discover  → GET  /connections/:id/subscriptions
  → Select    → POST /connections/:id/subscriptions/select
  → Sync      → POST /connections/:id/sync
       → redirect to /dashboard-saas
```

---

## API endpoints (v1)

All endpoints are tenant-scoped — resolved from the caller's Clerk JWT
(`org_id` → `Tenant` → `AzureConnection`), not from a caller-supplied ID.

| # | Endpoint | Description |
|---|---|---|
| 1 | `GET /health` | Service liveness (**shipped**) |
| 2 | `POST /connections` | Issues an admin-consent URL, creates a `PENDING_CONSENT` `AzureConnection` |
| 3 | `GET /connections/:id` | Poll consent/role-assignment status |
| 4 | `GET /connections/:id/subscriptions` | Subscriptions visible once `ACTIVE` |
| 5 | `POST /connections/:id/subscriptions/select` | Narrow monitoring to specific subscriptions |
| 6 | `POST /connections/:id/sync` | Trigger a cost-data pull |
| 7 | `GET /costs/daily`, `/costs/accumulated`, `/costs/by-service`, `/costs/by-resource` | Same shapes as BYOC's `apps/api`, tenant-scoped |

Endpoints 2–7 are not yet built.

---

## Data model (v1 — real multi-tenancy)

Matches `apps/api-saas/prisma/schema.prisma` as shipped today.

```prisma
model Tenant {
  id          String            @id @default(cuid())
  clerkOrgId  String            @unique
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  connections AzureConnection[]

  @@map("tenant")
}

enum ConnectionStatus {
  PENDING_CONSENT
  PENDING_ROLE_ASSIGNMENT
  ACTIVE
  ERROR
  REVOKED
}

model AzureConnection {
  id                        String            @id @default(cuid())
  tenantId                  String
  tenant                    Tenant            @relation(fields: [tenantId], references: [id])
  azureTenantId             String
  consentGrantedAt          DateTime?
  roleAssignmentConfirmedAt DateTime?
  status                    ConnectionStatus  @default(PENDING_CONSENT)
  selectedSubscriptionIds   String[]          @default([])
  lastSyncedAt              DateTime?
  lastSyncError             String?
  createdAt                 DateTime          @default(now())
  updatedAt                 DateTime          @updatedAt

  @@index([tenantId])
  @@map("azure_connection")
}
```

No secret/credential column — see "Cross-tenant access mechanism" above.

---

## Security rules (non-negotiable)

- The CloudGuard-owned App Registration credential is a **certificate**,
  stored only as a Railway env var — never in Neon, never logged.
- Every `apps/api-saas` query is scoped by `tenantId` resolved from the
  verified Clerk JWT — never from a client-supplied tenant/connection ID
  alone. A request authenticated as one tenant must never be able to read or
  mutate another tenant's `AzureConnection` or cost data. Enforced two ways:
  app-level (guard-resolved `tenantId`, threaded through
  `PrismaService.runInTenantContext`) and Postgres RLS on `azure_connection`
  as the DB-enforced backstop — see "What multi-tenant means here" for the
  Neon-role requirement this depends on.
- No line-item cost data is persisted long-term — same "query live, short
  cache" posture as BYOC.
- Revoking access is an Azure Portal action (remove the role assignment or
  revoke consent) on the customer's side; `apps/api-saas` detects this via a
  health-check poll and marks the connection `REVOKED`.

---

## Open items

- **RLS is shipped for `azure_connection`, verified against a real
  non-superuser role** (both raw SQL and the actual generated Prisma client
  were tested: 0 rows with no tenant context, 0 with the wrong one, 1 with
  the right one). Remaining follow-up: when the Neon project is created
  (Step 5), the app's `DATABASE_URL` role must explicitly exclude
  `neon_superuser`/`BYPASSRLS` — see "What multi-tenant means here" for why
  Neon's default role doesn't work for this.
- **Cache (Upstash) and Jobs (Trigger.dev) are decided but not built** —
  see `docs/plan/architecture.md` for current status. No caching or scheduled
  sync exists in `apps/api-saas` yet.
- **Secrets manager for SaaS** is not yet named — "any secrets manager" is
  a placeholder; the App Registration certificate currently lives as a
  Railway env var, per the Security rules above.
- **Credential rotation runbook** for the shared App Registration
  certificate — needs to exist before the first real customer connects, not
  after an incident.
- **Shared cost-query logic** (`cost-management.service.ts`'s date-boundary
  handling) is currently duplicated between `apps/api` and `apps/api-saas`
  rather than extracted into `packages/shared`, to avoid any risk to BYOC's
  tested code during the SaaS tier's initial build. Revisit as a separate,
  independently-reviewed change once the SaaS tier is stable.
- **Billing/plan gating** is out of scope for v1 — SaaS-tier access is
  ungated (any org can start the connect flow); a payment gate is a later,
  separate piece of work.
