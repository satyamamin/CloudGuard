# BYOC Solution Review & Tier Comparison — Session Notes

> Captures the exchange starting from the BYOC (customer-hosted) solution
> review through the tier-prioritization and workspace-structure discussion.

---

## 1. BYOC / Self-Hosted Solution — As Proposed

**Components:**

- **Resource Group** — container for everything, named/scoped by the customer at deploy time
- **Azure Container App with a system-assigned Managed Identity** — hosts the NestJS backend API; `DefaultAzureCredential` resolves via this identity, no client secret ever needed
- **Azure Database for PostgreSQL – Flexible Server (Burstable tier)** — single-tenant DB, one per deployment (physical isolation, no row-level tenancy)
- **Role assignments**: Reader + Cost Management Reader, granted to the Managed Identity, scoped to the subscription(s) the customer selects during deployment (subscription-scoped even though the template itself deploys at RG scope, via `modules/role-assignments.bicep` with `targetScope = 'subscription'`)
- **No Key Vault for customer creds** — none to store (MI-only auth). CloudGuard itself hosts only the Next.js frontend (Vercel) centrally; nothing customer-specific lives outside their tenant.
- **Deployment outputs**: Backend URL + API key, which the customer pastes into CloudGuard's frontend once to pair.

---

## 2. Review

### What's right about it

**System-assigned Managed Identity is the correct call, and fixes a real problem.** In the SaaS tier, CloudGuard's backend lives *outside* the customer's tenant, so cross-tenant auth requires `ClientSecretCredential` — a secret has to exist somewhere. In BYOC, the backend deploys *inside* the customer's own tenant, reading their own subscriptions — same-tenant, so Managed Identity works natively. **No secret to generate, store, rotate, or leak, ever.** This is a meaningfully stronger security posture than SaaS can offer and is worth using as a selling point with security-conscious prospects.

Subscription-scoped role assignment via a nested `targetScope = 'subscription'` module is also the right Bicep pattern — required to assign subscription-level RBAC from a resource-group-scoped deployment.

### Gaps to resolve before shipping

1. **The API key is the one remaining secret, and its handling is unclear.**
   - How is it generated (random at Container App startup, a deployment script, an env var default)?
   - **Deployment outputs are visible in plaintext in the Azure Portal's deployment history** to anyone with Reader access to that resource group — a real exposure path. Mitigate with the `@secure()` decorator in Bicep to prevent it appearing in output logs/history, or reconsider whether MI-to-frontend pairing can avoid a static key entirely.

2. **"Nothing customer-specific lives outside their tenant" overstates the isolation.** Per an earlier decision on record, the Backend URL and API key deployment outputs get stored in **Clerk organization metadata** as a v1 shortcut — that *is* customer-specific data living outside the customer's tenant. Reasonable as a pragmatic shortcut, but worth being precise about in any security questionnaire from a prospect: "your data stays in your tenant, but a URL + API key pointing at it is stored in our identity provider's metadata."

3. **Subscription-scope role assignment requires the deploying customer to already have elevated Azure permissions** (Owner or User Access Administrator on that subscription). Many people who'd click a self-serve deploy button won't have that — deployment will fail with a permissions error, likely without a clear explanation. Same access-prerequisite problem the manual SaaS flow already flags, but here it's silent until the ARM deployment fails partway through. Worth surfacing explicitly as a prerequisite in the BYOC deploy UI.

4. **No stated Postgres networking model.** Publicly accessible with a firewall rule scoped to the Container App's outbound IP, or VNet-integrated? Public-with-firewall is a reasonable MVP simplification, but should be a deliberate decision — especially given the target customer profile is security-conscious enterprise.

### Bottom line

The core credential model (Managed Identity over secrets) is the right architectural choice and a genuine differentiator. The gaps are all around the edges — the one remaining secret (API key), the deployment permission prerequisite, and precision about what "stays in tenant" actually means. None block shipping v1, but items 1 and 3 should be fixed before real customers hit them, since both fail silently or insecurely rather than gracefully.

---

## 3. Matrix Comparison: BYOC vs. SaaS (connect-azure.md)

| | BYOC / Self-Hosted Tier | SaaS Tier (connect-azure.md) |
|---|---|---|
| Where compute runs | Customer's own Azure tenant (Container App) | CloudGuard's infra — Railway |
| Where DB lives | Customer's tenant — Azure Postgres Flexible Server | CloudGuard's infra — Neon (shared Postgres) |
| Tenant isolation model | Physical — one DB per deployment | Logical — `tenantId` row scoping |
| Azure auth mechanism | System-assigned Managed Identity + `DefaultAzureCredential` | `ClientSecretCredential` (cross-tenant, no MI equivalent) |
| Secret to store | None for Azure auth — only a pairing API key | Customer's App Registration client secret, in Key Vault |
| Who assigns RBAC roles | Bicep template, at deploy time (needs customer to have Owner/UAA) | Customer, manually, in their own tenant (per checklist) |
| Setup friction for customer | Higher — click Deploy to Azure, grant subscription access, run template | Lower — paste 4 values into a form, no deployment required |
| CloudGuard's operational burden | Low — customer hosts and pays for it | Higher — CloudGuard runs, monitors, and secures everything |
| Where secrets are visible | Deployment output history unless masked with `@secure()` | Never returned in API responses; masked as `••••1234` |
| Best fit customer | Enterprise / data-residency-sensitive buyers | Smaller / faster-moving, self-serve buyers |

**Core trade-off:** BYOC pushes complexity onto the customer's deploy step but eliminates CloudGuard's secret-handling burden entirely (Managed Identity). SaaS keeps setup dead simple for the customer but makes CloudGuard responsible for storing and protecting a live Azure credential per customer.

Notable points:
- "Setup friction" and "operational burden" are inversely correlated by design — the classic BYOC-vs-SaaS trade-off, and the reason for offering both tiers to capture different buyer profiles.
- "Secret to store" is the sharpest technical contrast — BYOC's Managed Identity approach is strictly more secure than SaaS's Key Vault-stored client secret. Worth using explicitly in sales conversations with security-conscious BYOC prospects.
- "Where secrets are visible" is an open risk in BYOC today (the API key appearing in deployment output history) — a gap SaaS's masked-secret handling doesn't have.

---

## 4. Which Tier to Start With

**Decision: finish BYOC (it's mostly done), but push SaaS first to land the first customer.**

### Case for finishing BYOC first
- Sunk cost is real — Bicep template, Managed Identity pattern, `connect-azure.md` spec, and Prisma models are already built.
- Matches stated positioning — "security-conscious enterprise Azure customers with GDPR/EU data residency" is BYOC's strongest pitch.
- No infra to operate once shipped — customers host it; no Railway/Neon bills or uptime responsibility while pre-revenue.

### Case for prioritizing SaaS
- Faster time-to-first-demo — no "customer must click Deploy to Azure, grant subscription access, run a template" step.
- Easier to iterate — one central deploy vs. every change requiring customers to redeploy/update their own instance.
- Lower friction for the founder's own testing/demos — spin up a SaaS account in seconds vs. needing a customer Azure tenant every time.
- Easier first customer acquisition — one-click signup vs. asking a prospect to run an ARM deployment into their own subscription before they've decided to buy.

### Simplified takeaway
Finish BYOC since it's mostly done, but push SaaS first to land the first customer — it's the easier sell before there's any track record. BYOC becomes the upsell once credibility exists. This also matches how most bootstrapped B2B SaaS companies land their first few customers — the first deal is rarely the highest-friction tier.

---

## 5. VS Code Workspace Structure

**Decision: one workspace, structured as a monorepo — not separate VS Code projects.**

### Why one workspace
BYOC and SaaS share real code: the same Prisma schema (with `tenantId` in both), the same Clerk auth / `requireTenant` middleware, the same NestJS business logic for cost sync and anomaly detection. Only the data-access layer (which DB/cache/compute it talks to) diverges per tier. Separate projects would mean either duplicating shared code (drifts out of sync) or managing a shared package across two repos — unnecessary overhead for a solo founder.

### Suggested structure

```
cloudguard-workspace/
├── packages/
│   ├── core/              # shared: Prisma schema, business logic, Clerk auth middleware
│   ├── saas-api/          # NestJS app — SaaS tier (Railway/Neon/Upstash specifics)
│   └── byoc-api/          # NestJS app — BYOC tier (Azure MI/Postgres/Cache specifics)
├── prisma/
│   └── schema.prisma      # one shared schema, both tiers migrate from this
├── package.json            # workspace root (npm/pnpm workspaces or Turborepo)
```

This maps directly onto the tier-comparison table above: `core/` holds everything that's the same for both tiers (auth, jobs, business logic); `saas-api/` and `byoc-api/` hold everything that diverges (compute target, DB connection, cache client).

### Tooling note
npm workspaces or pnpm workspaces (built into npm/pnpm, no extra tooling) is sufficient at current scale — no need for Turborepo or Nx yet. Add that later only if build times or CI complexity become an actual problem.

### Open item
Confirm what's currently inside the existing `cloudguard-workspace/` folder (from the project's CLOUDGUARD folder structure) — this monorepo layout may slot directly into that existing folder rather than requiring a new one.
