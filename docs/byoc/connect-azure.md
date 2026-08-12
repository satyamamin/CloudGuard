# Connect Azure — Onboarding Flow (v1 — Customer-Hosted)

> Module: Core API — "Connect & Discover"
> Status: v1 scope locked — **architecture pivot, supersedes the Service
> Principal / shared-backend version of this doc**

---

## Architecture pivot (why this doc changed)

**v0 plan (shared SaaS backend):** CloudGuard hosts one multi-tenant backend
+ database. Each customer creates a Service Principal in their own tenant and
pastes Tenant ID / Client ID / Secret into a form so CloudGuard's shared
backend can read their data cross-tenant.

**v1 plan (this doc):** CloudGuard has **no backend of its own yet**. The
customer deploys the backend + database directly **into their own Azure
tenant** via a "Deploy to Azure" button (ARM/Bicep template). The only thing
CloudGuard hosts centrally is the frontend (Next.js on Vercel).

This is a strictly better fit for the GDPR/EU-data-residency pitch already in
the business plan — customer data never leaves their own tenant, because
there's no central database to leave it in.

**Provisioning mechanism for v1:** "Deploy to Azure" button (ARM/Bicep).
Chosen over an Azure Marketplace Managed Application (slower — publisher
review/certification) and a Terraform CLI module (less turnkey for a
non-technical buyer during a self-serve trial). Revisit once volume justifies
the Marketplace listing overhead.

---

## What changes for the customer

No more Service Principal creation, no client secret, no manual credential
form. The ARM/Bicep template provisions everything and grants access itself.

## What changes for the backend

The backend now runs as a resource *inside* the customer's own subscription.
It authenticates to Cost Management / Resource Graph with a **system-assigned
Managed Identity** — `DefaultAzureCredential` works immediately, because
there is no cross-tenant boundary left to cross. This is the same
credential pattern already decided for CloudGuard's own infrastructure; v1
simply extends it to every customer deployment instead of needing a second,
cross-tenant pattern (`ClientSecretCredential`) at all.

---

## What the template provisions

| Resource | Purpose |
|---|---|
| Resource Group | Container for everything below, named/scoped by the customer at deploy time |
| Container App (system-assigned Managed Identity) | Backend API |
| Azure Database for PostgreSQL — Flexible Server (Burstable tier) | Single-tenant DB — right-sized for a trial, not the eventual production tier |
| Role assignments: **Reader** + **Cost Management Reader** | Granted directly to the Managed Identity, scoped to the subscription(s) chosen during deployment |

No Key Vault for customer credentials — there are none to store. (The
backend may still use a lightweight secret store for its own DB connection
string; that's an internal implementation detail, not part of this flow.)

---

## Deployment parameters (Azure's own form, not CloudGuard's UI)

| Field | Notes |
|---|---|
| Subscription | Azure's native picker — this is also the scope for the role assignment |
| Resource group name | Customer's naming convention |
| Region | EU-based options only, to match the GDPR/data-residency pitch |
| Environment name / prefix | Used to name the provisioned resources |

## Fields on CloudGuard's frontend (post-deploy, one-time)

| Field | Type | Required | Notes |
|---|---|---|---|
| Backend URL | string | Yes | Deployment output — where the customer's instance lives |
| API key | string (masked input) | Yes | Deployment output — authenticates the frontend to *this customer's* backend only |

**v1 shortcut (flag to revisit):** since CloudGuard has no backend of its own
to persist this pairing, store Backend URL + API key in **Clerk
organization metadata** rather than standing up a database just to hold two
strings. Fine for a trial; revisit before this needs to survive a Clerk
migration or support anything beyond a single linked instance per customer.

---

## Onboarding sequence

```
Click "Deploy to Azure"
  → Azure Portal deployment wizard (customer picks subscription, region, RG name)
  → ARM/Bicep template provisions Container App + Postgres + Managed Identity
  → Template grants Reader + Cost Management Reader on the chosen subscription(s)
  → Deployment output: Backend URL + API key
  → Customer pastes both into CloudGuard's frontend (one-time)
       → GET /health confirms the pairing works
  → Discover  → GET  /subscriptions
  → Select    → POST /subscriptions/select
  → Sync      → POST /sync
       → redirect to dashboard, "crunching your data" loading state
```

---

## API endpoints (v1 — trimmed)

There is no "connections" resource anymore — the deployment itself is the
connection. What's left:

| # | Endpoint | Description | Priority |
|---|---|---|---|
| 1 | `GET /health` | Confirms Backend URL + API key are valid, reachable | Must |
| 2 | `GET /subscriptions` | Subscriptions visible to this instance's Managed Identity | Must |
| 3 | `POST /subscriptions/select` | Customer narrows monitoring to specific subscriptions | Must |
| 4 | `GET /status` | Last sync time, current sync state, last error | Must |
| 5 | `POST /sync` | Trigger a cost-data pull | Must |

Dropped entirely from v0: `test`, `create`, `list`, `rename`/rotate,
`delete`, `permissions-check`. Revoking access is now an Azure Portal
action (delete the resource group) rather than an API call.

---

## Data model (v1 — single-tenant, no scoping column)

Each deployment has its own isolated database, so there's no multi-tenancy
column to enforce — isolation is physical, not row-level. This replaces the
`AzureConnection` model entirely with a single configuration row.

```prisma
model Instance {
  id                      String    @id @default(cuid())
  selectedSubscriptionIds String[]  @default([])
  lastSyncedAt            DateTime?
  lastSyncError           String?
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt

  @@map("instance")
}
```

---

## Security rules (non-negotiable)

- Managed Identity only — no Azure credential of any kind is ever entered,
  stored, or transmitted for reading the customer's cost data
- The frontend↔backend API key is shown once at deployment; store it masked
  wherever it's displayed again
- Postgres lives inside the customer's own tenant/region — data residency is
  automatic, not something CloudGuard has to engineer
- No CloudGuard-side database in v1 — nothing centrally aggregated, nothing
  centrally at risk

---

## Open items

- **Sync execution:** with one instance per customer instead of a shared
  multi-tenant backend, Trigger.dev's job-queue model may be more than v1
  needs — an Azure Container Apps scheduled job (cron) inside the same
  deployment could replace it and drop an external dependency. Worth
  deciding before Month 2 (Azure Connector) rather than after.
- **Clerk-metadata pairing** is a deliberate v1 shortcut (see above) —
  revisit once an instance needs to support more than a single linked
  backend per customer.
