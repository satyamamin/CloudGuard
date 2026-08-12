# Initial Vision Archive (Founder-Stage Planning, ~March 2026)

> **ARCHIVED — HISTORICAL REFERENCE ONLY.**
>
> This document is a preserved snapshot of CloudGuard 360's *original, early-stage* founder
> planning and product vision, dated to approximately March 2026 based on internal version
> markers (`v1.0 · MARCH 2026` in the architecture slide deck, and the "Solo founder daily hub ·
> March 2026" heading in the Notion workspace script). It consolidates the substantive planning
> content that previously lived in two now-deleted, non-functional scaffolding locations:
>
> - `jsx/` — a standalone Vite+React "slide deck" viewer (`archi.jsx`, `database.jsx`,
>   `detailed_roadmap.jsx`, `phases_func_mapping.jsx`) used to present architecture and roadmap
>   docs as interactive slides.
> - `cloudguard-notion-setup/setup.js` — a one-off Node script that provisioned a Notion
>   workspace with the founder's dashboard, roadmap, sprint board, CRM, KPIs, and research notes.
>
> **`docs/byoc/connect-azure.md` is the current, authoritative architecture document for CloudGuard
> 360.** It describes the actual v1 product under active development. This archive is historical
> only — several technical decisions described below were later reversed, most significantly the
> move from a CloudGuard-hosted, multi-tenant backend to a **customer-hosted, single-tenant
> backend model with no CloudGuard database at all**. Where a decision here was superseded, it is
> called out explicitly. Do not use this document as a source of truth for current architecture,
> stack, or roadmap status.

---

## 1. Early Architecture Vision (from `archi.jsx`)

This section preserves the original high-level/low-level design ("HLD/LLD") vision: a
multi-tenant SaaS platform with a CloudGuard-hosted backend, shared Postgres with row-level
security, Redis, a message bus, and an AI Copilot — a materially different shape from the
shipped v1 product.

### 1.1 What changed — early vision vs. current product

| Area | Early vision (this archive) | Current product (`docs/byoc/connect-azure.md`) |
|---|---|---|
| Backend framework | **FastAPI (Python)** *(per Notion script)* / **NestJS** *(per architecture deck — the deck and Notion script disagree; NestJS is what shipped)* | NestJS |
| Backend hosting | Azure Container Apps, **hosted and operated by CloudGuard** (multi-tenant, Min 1/Max 10 replicas) | Deployed **into the customer's own Azure tenant** via "Deploy to Azure"; CloudGuard only hosts the frontend |
| Database | PostgreSQL + **TimescaleDB**, with **Row-Level Security (RLS)** for per-tenant isolation, shared across all customers | Plain Postgres via Prisma, **one instance per customer deployment** — physical isolation, no RLS/tenancy column, no TimescaleDB |
| Cache | **Redis** (Azure Cache for Redis) | None |
| Job runner | **Trigger.dev** (managed SaaS) + **Azure Service Bus** for async ingestion | None — `/sync` is synchronous, in-process, re-entrancy-locked |
| Auth to Azure | **DefaultAzureCredential + Workload Identity** (Container Apps) | System-assigned **Managed Identity** on the customer's own deployed Container App — no client secret ever entered/stored |
| Tenant isolation | Three-layer model: Clerk auth → NestJS `TenantGuard` → PostgreSQL RLS | Physical isolation — one Postgres instance per deployment; no multi-tenancy scoping column exists |
| Vector store / AI | **pgvector** on the shared Postgres, Azure OpenAI `gpt-4o`, RAG Copilot module | Not present in v1 |
| Secrets | **Azure Key Vault** | None needed — no client secrets in the Managed Identity model |
| CI/CD | GitHub Actions + **Terraform** (plan/apply, blue-green via Container Apps revisions) | No CI pipeline reaches into a customer's tenant; Bicep, not Terraform |

The rest of this section preserves the original vision's content as designed, for historical
record.

### 1.2 Executive summary / core design principles

CloudGuard 360 was originally envisioned as a **multi-tenant SaaS platform** delivering unified
FinOps and cloud governance for enterprise Azure environments — real-time cost visibility,
anomaly detection, compliance monitoring, and AI-powered Q&A from a single dashboard, with
"zero cross-tenant data leakage."

Core design principles:

- **Multi-Tenant SaaS** — each enterprise fully isolated from day one, enforced at auth,
  application, and database layers simultaneously.
- **Modular Monolith** — single deployable unit with clean module boundaries, designed for
  future microservice extraction.
- **TypeScript Everywhere** — frontend, backend, jobs, shared contracts — one language, one
  compiler, one type system.
- **Cloud-Agnostic Core** — Azure connectors in MVP; architecture intended to support AWS/GCP
  connectors via the same adapter pattern.
- **AI-Ready from Day One** — Copilot and anomaly detection as first-class modules, not
  bolted on.
- **Security-First Design** — DefaultAzureCredential, Workload Identity, PostgreSQL RLS, WAF
  layered at every tier.

MVP scope — 7 capability areas:

1. Azure Connector — cost management, resource graph, advisor, monitor
2. FinOps Dashboard — real-time cost visibility per subscription / tag / region
3. Cost Anomaly Detection — with root-cause hints and alerts
4. Budget Alerts & Forecasting — threshold-based with Resend email notifications
5. Storage PII Scanning — data residency policy compliance checks
6. Audit Report Export — PDF and CSV via Azure Blob signed URLs
7. Copilot Q&A — natural language over connected accounts and findings (RAG)

System actors: Enterprise Admin, FinOps Analyst, Security Officer, Copilot User, Azure Platform,
Clerk, Stripe.

### 1.3 High-level architecture — layers and deployment

Architecture layers:

| Layer | Components | Responsibility |
|---|---|---|
| Edge & Security | Azure Front Door + WAF | Global entry point, DDoS protection, WAF rules, SSL termination, geo-routing |
| Presentation | Next.js 14 on Vercel | SSR/CSR dashboard, App Router, Tailwind + shadcn/ui |
| API | NestJS on Azure Container Apps | REST + tRPC, Auth/Tenant/Role guards, business logic, orchestration |
| Data | PostgreSQL + TimescaleDB + Redis + pgvector | OLTP persistence, time-series cost data, caching, RAG embeddings |
| Integration | Azure SDK + Service Bus + Trigger.dev | Azure telemetry ingestion, async job processing, circuit breaking |

Deployment architecture:

| Component | Platform | Scaling | Region |
|---|---|---|---|
| Frontend | Vercel Edge Network | Automatic (CDN) | Global |
| API (NestJS) | Azure Container Apps | Min 1, Max 10 replicas | West Europe |
| PostgreSQL | Azure DB for PostgreSQL Flexible Server | Vertical + Read Replicas | West Europe + DR |
| Redis | Azure Cache for Redis | Standard tier, clustered | West Europe |
| Service Bus | Azure Service Bus (Standard) | Partitioned topics | West Europe |
| Jobs (Trigger.dev) | Trigger.dev Cloud | Managed, auto-scale workers | Managed SaaS |
| Secrets | Azure Key Vault | N/A (managed service) | West Europe |
| Observability | Azure Monitor + Grafana | N/A (managed) | Global |

Full data flow (as designed):

```
[Azure Subscriptions]
  Azure SDK (arm-costmanagement, arm-resourcegraph, arm-advisor, arm-monitor)
[Azure Service Bus] — ingestion queue, async decoupling, retry support
[Trigger.dev Workers] — TypeScript job consumers, scheduled ingestion tasks
[NestJS API — Azure Container Apps]
  Guards: Auth | Tenant | Roles
  Modules: FinOps | Anomaly | Copilot | Compliance | Billing
  Circuit Breaker (cockatiel) on all Azure SDK calls
[PostgreSQL + TimescaleDB] (RLS per tenant) / [Redis Cache] (TTL per data type) / [pgvector — RAG] (Copilot embeddings)
[Azure OpenAI] — Copilot inference, anomaly root-cause hints
[Next.js — Vercel] <-> REST + tRPC <-> [NestJS API]
[Azure Front Door + WAF] — global edge, WAF, DDoS, SSL
[Clerk] — Auth, SSO/Entra ID, tenant org management
[Stripe] — billing, invoices, subscription plans
[Sentry] — error tracking (frontend + backend)
[OpenTelemetry -> Azure Monitor -> Grafana] — observability
```

Multi-tenancy — three-layer isolation model (superseded by physical per-customer isolation in
the current product):

1. **Layer 1 — Authentication**: Clerk org membership validates tenant identity on every request.
2. **Layer 2 — Application**: NestJS `TenantGuard` injects `tenantId` into all service calls,
   blocking cross-tenant access at application level.
3. **Layer 3 — Database**: PostgreSQL RLS policies enforce tenant isolation at the database
   engine level — non-bypassable.

> Tenant isolation guarantee (as designed): "Even if application-level guards are bypassed (e.g.
> due to a bug), PostgreSQL RLS policies ensure that no query can return rows from a different
> tenant."

### 1.4 Technology stack (as originally envisioned)

**Frontend:**

| Technology | Version / Config | Purpose |
|---|---|---|
| Next.js | 14 — App Router, RSC | SSR, routing, API routes |
| TypeScript | 5.x — strict mode | Type safety everywhere |
| Tailwind CSS | 3.x — JIT | Utility-first styling |
| shadcn/ui | Latest — Radix primitives | Accessible component library |
| tRPC Client | 10.x — React Query adapter | Type-safe internal API calls |
| Clerk (Next.js SDK) | Latest | Auth middleware, session management |
| Recharts / D3 | Latest | Cost charts, trend visualisation |
| Vercel | Edge Network | Hosting, Edge Functions, ISR |

**Backend:**

| Technology | Version / Config | Purpose |
|---|---|---|
| NestJS | 10.x — modular monolith | Backend framework, DI container |
| TypeScript | 5.x — strict mode | Type safety, shared contracts |
| Prisma ORM | 5.x | OLTP queries, migrations, schema |
| tRPC Server | 10.x | Type-safe procedures for internal UI |
| Clerk (Node SDK) | Latest | JWT verification, user/org management |
| Pino | 8.x | Structured JSON logging |
| OpenTelemetry | @opentelemetry/sdk-node | Distributed tracing, metrics export |
| cockatiel | 3.x | Circuit breaker for Azure SDK calls |
| Azure Container Apps | Consumption plan | Hosting, auto-scaling, Workload Identity |

**Planned application routes:**

| Route | Module | Description |
|---|---|---|
| `/dashboard` | FinOps Overview | Cost summary, top services, trend chart, budget status |
| `/dashboard/anomalies` | Anomaly Detection | Detected anomalies with severity, service, root-cause hint |
| `/dashboard/budgets` | Budgets & Alerts | Budget config, forecast vs actual, alert thresholds |
| `/dashboard/compliance` | Compliance | PII scan results, residency violations, audit logs |
| `/copilot` | AI Copilot | Chat interface for natural language queries |
| `/settings/connectors` | Azure Connectors | Add/manage Azure subscriptions, credential health status |
| `/settings/billing` | Billing | Stripe subscription management, invoice history |
| `/reports` | Reports | Export audit reports as PDF/CSV |

**NestJS modules:**

| Module | Services | Responsibility |
|---|---|---|
| AuthModule | AuthGuard, TenantGuard, RolesGuard | JWT validation, tenant resolution, RBAC enforcement |
| TenantModule | TenantService, TenantResolver | Tenant lifecycle, Clerk orgId → internal tenantId mapping |
| ConnectorModule | ConnectorService, AzureAdapterService | Azure subscription management, credential storage, health checks |
| FinOpsModule | CostService, BudgetService, ForecastService | Cost aggregation on TimescaleDB, budget CRUD, forecasting |
| AnomalyModule | AnomalyDetectionService, AlertService | Statistical anomaly detection, root-cause attribution, alerts |
| CopilotModule | CopilotService, EmbeddingService, RAGService | Query processing, pgvector retrieval, Azure OpenAI, SSE streaming |
| ComplianceModule | PIIScanService, AuditService, ReportService | Storage PII scanning, residency checks, audit log, PDF export |
| BillingModule | StripeWebhookService, SubscriptionService | Stripe webhook handling, subscription state, invoice sync |
| IngestionModule | ServiceBusConsumer, IngestionPipeline | Service Bus consumption, normalisation, TimescaleDB writes |

**Request pipeline (10 steps, as designed):** HTTP adapter → Helmet security headers → rate
limiter (per IP/tenant) → `AuthGuard` (Clerk JWT) → `TenantGuard` (resolve tenantId) →
`RolesGuard` → route handler/tRPC procedure → Prisma queries auto-scoped by `tenant_id` →
PostgreSQL RLS enforcement → response serialised, OpenTelemetry span closed.

### 1.5 Data layer (architecture-deck version)

Tables (see also Section 2 for the more detailed `database.jsx` version):

- **tenants** — root isolation boundary, no RLS needed, 1 row per enterprise customer
  (`id`, `clerk_org_id`, `name`, `plan`, `created_at`).
- **connectors** — one row per Azure subscription per tenant (`id`, `tenant_id`, `cloud`,
  `subscription_id`, `status`); credentials referenced in Key Vault, not stored in this table.
- **cost_records** — TimescaleDB hypertable, core FinOps data, partitioned by day, compression
  after 7 days, 90-day raw retention (`time`, `tenant_id`, `connector_id`, `service_name`,
  `amount`, `currency`, `tags`).
- **anomalies** — populated post-ingestion by `AnomalyDetectionService`, Z-score + rolling
  baseline algorithm (`id`, `tenant_id`, `detected_at`, `service`, `severity`, `root_cause`,
  `status`).
- **budgets** — alert % triggers Resend email via `AnomalyModule` (`id`, `tenant_id`,
  `connector_id`, `amount`, `period`, `alert_threshold`).
- **audit_logs** — append-only, no UPDATE/DELETE permission, 90-day retention (`id`, `tenant_id`,
  `user_id`, `action`, `resource_type`, `timestamp`, `metadata`).
- **copilot_embeddings** — pgvector, HNSW index, chunk size 512 tokens / 64-token overlap
  (`id`, `tenant_id`, `source_type`, `source_id`, `embedding vector(1536)`, `content`).
- **users** — synced from Clerk webhooks, drives RolesGuard (`id`, `tenant_id`,
  `clerk_user_id`, `email`, `role` [ADMIN | ANALYST | VIEWER]).

RLS policy pattern (as designed):

```sql
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON {table}
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
-- Application sets this before every query:
SET LOCAL app.tenant_id = '{tenantId}';
```

Redis caching strategy:

| Key Pattern | Data | TTL | Invalidation Trigger |
|---|---|---|---|
| `cost:{tenantId}:{period}` | Aggregated cost data | 60 min | On new ingestion batch |
| `budget:{tenantId}:{budgetId}` | Budget + current spend | 5 min | On budget update |
| `anomaly:{tenantId}:list` | Active anomalies list | 10 min | On anomaly detection run |
| `tenant:{tenantId}:config` | Tenant settings, connectors | 30 min | On tenant config change |
| `session:{userId}` | User session data | 24 hr | On logout or role change |
| `copilot:ctx:{tenantId}:{hash}` | RAG retrieval cache | 15 min | On new embeddings indexed |

> Critical rule (as designed): "Redis is NOT the source of truth. Any Redis key can be flushed
> and rebuilt from PostgreSQL. Never store data that exists only in Redis."

### 1.6 Azure ingestion pipeline

Nine-step flow (as designed): Trigger.dev scheduled job fires hourly per connector →
`AzureAdapterService` calls Azure SDK via `DefaultAzureCredential` (Workload Identity) →
cockatiel circuit breaker monitors failure rate (opens after 5 consecutive failures) → raw cost
data published to Service Bus topic `cost-ingestion-{tenantId}` → `IngestionPipeline` consumer
normalises records → batch-insert into `cost_records` hypertable → `AnomalyDetectionService`
evaluates latest window → Redis cache invalidated for affected tenant → alert dispatched via
Resend email if anomaly detected.

Circuit breaker configuration (cockatiel): failure threshold 5 consecutive failures → circuit
OPEN; recovery probe 30s; half-open state 1 test request; max retries 3 with jittered exponential
backoff (base 1s, max 30s); rate limit 1 req/s per tenant for Azure Cost Management API.

Azure SDK modules planned: `@azure/arm-costmanagement` (QueryUsage), `@azure/arm-resourcegraph`
(Resources.list), `@azure/arm-advisor` (Recommendations.list), `@azure/arm-monitor`
(Metrics.list), `@azure/identity` (DefaultAzureCredential).

### 1.7 Security architecture

RBAC model — three roles:

| Role | Permissions | Typical users |
|---|---|---|
| ADMIN | Full CRUD on all resources, manage connectors, billing, users | Cloud Platform Lead, CTO |
| ANALYST | Read all, create/update budgets and alerts, export reports | FinOps Analyst, Cloud Engineer |
| VIEWER | Read-only access to dashboards, anomalies, compliance | CIO, Security Officer, Auditor |

Security layers (defence in depth, as designed): Identity & Access (Clerk + Entra ID SSO, JWT
claims carry orgId); Secrets Management (Azure Key Vault + DefaultAzureCredential/Workload
Identity — no static secrets in env vars); Network Security (Azure Front Door WAF, OWASP Top-10,
rate limiting, geo-blocking); API Security (NestJS Guards + Helmet + CORS + rate limiter on every
route); Data Encryption (AES-256 at rest, TLS 1.3 in transit); Compliance (audit log on every
tenant action, PII scanning for storage residency).

Clerk webhook integration: `ClerkProvider` wraps Next.js, middleware protects all routes except
`/login` and `/signup`; Microsoft SSO configured as Clerk OAuth provider (Entra ID from day one);
webhooks (`user.created`, `organization.created`, `membership.updated`) synced to PostgreSQL;
`@clerk/backend verifyToken()` validates JWT on every NestJS request; `TenantService` resolves
`clerk_org_id` → internal `tenantId`, cached in Redis for 30 min.

### 1.8 AI Copilot & RAG architecture

Copilot stack components: LLM (Azure OpenAI `gpt-4o`), Embedding Model (Azure OpenAI
`text-embedding-3-small`), Vector Store (pgvector on existing PostgreSQL), Index Type (HNSW),
RAG Orchestration (NestJS `CopilotModule`), Streaming (Server-Sent Events).

RAG pipeline (8 steps, as designed): user sends query → query embedded via
`text-embedding-3-small` → pgvector HNSW search (top-10 chunks, `WHERE tenant_id = $tenantId`) →
chunks ranked by cosine similarity, top-5 selected → system prompt assembled (tenant context +
chunks + query) → `gpt-4o` completion streamed via Azure OpenAI → tokens streamed to frontend via
SSE → response stored in conversation history.

Embedding strategy — what gets embedded: Cost Records (daily summaries, hourly refresh post-
ingestion), Anomalies (description + root-cause, on detection), Compliance Findings (PII scan
summaries + policy violations, on scan completion), Advisor Recommendations (text + impact,
daily). Chunk size: 512 tokens with 64-token overlap. Vector dimensions: 1536. Tenant isolation:
pgvector queries include `WHERE tenant_id = $tenantId`, RLS backed.

### 1.9 CI/CD & infrastructure

Pipeline stages (as designed): Code Quality (GitHub Actions — ESLint, TS strict, Prettier) →
Testing (Jest — unit/integration/e2e via Playwright) → Security Scan (Snyk + Checkov) → Build
(Docker image → Azure Container Registry) → IaC Plan (Terraform plan on PR, human approval) →
Deploy Staging (auto-deploy on merge to main) → Deploy Prod (manual approval gate, blue/green via
Container Apps revisions) → DB Migration (`prisma migrate deploy` in pipeline before API starts).

Terraform-managed resources (as designed): Azure Container Apps environment + NestJS app; Azure
DB for PostgreSQL Flexible Server (TimescaleDB extension); Azure Cache for Redis; Azure Service
Bus namespace + topics/subscriptions; Azure Key Vault + Workload Identity access policies; Azure
Front Door + WAF policy; Azure Monitor workspace + Grafana dashboard provisioning; Azure
Container Registry.

Observability stack: Logs (Pino → Azure Monitor), Metrics (OpenTelemetry → Grafana), Traces
(OpenTelemetry → Azure Monitor), Errors (Sentry, frontend + backend).

### 1.10 Non-functional requirements & risk register

| Attribute | Requirement | Mechanism | Target |
|---|---|---|---|
| Availability | Platform stays available during Azure API outages | Async ingestion + circuit breaker + cached data | 99.5% SLA |
| Scalability | Handle 100 tenants, 1000 subscriptions at MVP | Container Apps auto-scale, TimescaleDB compression | Linear scale |
| Performance | Dashboard load < 2s; Copilot first token < 3s | Redis cache, continuous aggregates, HNSW index | p95 targets |
| Security | Zero cross-tenant data leakage | RLS + TenantGuard + Workload Identity + WAF | Zero tolerance |
| Data Residency | EU data stays in EU (West Europe) | All Azure resources in West Europe region | GDPR compliant |
| Recoverability | RPO ≤ 4 hours, RTO ≤ 1 hour | Geo-redundant PostgreSQL backups, runbook automation | Tier 2 DR |
| Observability | All requests traced end-to-end | OpenTelemetry auto-instrumentation | 100% trace coverage |
| Auditability | All user actions logged and immutable | Append-only audit_logs, no DELETE permission | 90-day retention |

Risk register:

| Risk | Likelihood | Impact | Mitigation | Status |
|---|---|---|---|---|
| Cross-tenant data leak via Prisma bug | Low | Critical | PostgreSQL RLS as safety net; tenant isolation tests in CI | Open |
| Azure API throttling breaks ingestion | High | Medium | Circuit breaker + Service Bus queue + exponential backoff | Mitigated |
| Secrets leak via env vars | Medium | Critical | Azure Key Vault + Workload Identity (no static secrets) | Open |
| Copilot hallucination on cost data | Medium | Medium | RAG grounds responses in real data; UI shows source citations | Open |
| Vercel/Azure split deployment CORS | Medium | High | CORS tested in CI; Azure Front Door as single entry point | Open |
| TimescaleDB queries slow at 90-day volume | Medium | Medium | Continuous aggregates + compression + retention policy | Mitigated |
| Clerk org/tenant mapping drift | Low | High | Webhook-driven sync; nightly reconciliation job | Open |

### 1.11 Architecture Decision Records (original)

| ID | Decision | Rationale | Alternatives rejected |
|---|---|---|---|
| ADR-01 | Modular Monolith over Microservices | Single team, MVP speed, clear module boundaries for future extraction | Microservices (too complex for MVP); Serverless (cold starts for long-running ingestion) |
| ADR-02 | TimescaleDB over ClickHouse | Reuses existing PostgreSQL infra, Prisma compatible, standard SQL | ClickHouse (operational overhead); BigQuery (vendor lock-in, latency) |
| ADR-03 | pgvector over Pinecone for RAG | No additional service, tenant RLS applies automatically, cost-effective | Pinecone (extra cost, no RLS); Weaviate (operational complexity) |
| ADR-04 | Azure Service Bus over direct DB writes | Decouples ingestion from processing, handles throttling, retry without data loss | Direct PostgreSQL write (no buffering); Kafka (operational overhead for MVP) |
| ADR-05 | Clerk for Auth over custom Auth | Enterprise SSO (Entra ID) out-of-box, MFA, org management | Auth0 (higher cost at scale); Custom JWT (build effort, security risk) |
| ADR-06 | PostgreSQL RLS for tenant isolation | Non-bypassable safety net independent of application code | Application-only isolation (single point of failure); separate DB per tenant (operational complexity) |
| ADR-07 | DefaultAzureCredential + Workload Identity | No static secrets, automatic rotation, Azure best practice | ClientSecretCredential (static secret still required); Managed Identity only (limited to Azure-hosted) |

*(Note: ADR-07's underlying philosophy — avoiding static secrets — did carry forward into the
current product, but via a different mechanism: system-assigned Managed Identity on a
customer-deployed Container App, rather than Workload Identity on a CloudGuard-hosted one.)*

---

## 2. Early Database Schema Design (from `database.jsx`)

This section documents "where all data is stored" across five originally-planned storage
systems: PostgreSQL + TimescaleDB (primary store), Redis (cache layer), Clerk (identity store),
Azure Blob Storage (file store), and Trigger.dev (job state).

### 2.1 PostgreSQL + TimescaleDB — primary store

Host (production): Azure Database for PostgreSQL Flexible Server. Local dev: Docker
(`timescale/timescaledb:latest-pg16`). Role: single source of truth for all persistent business
data.

| Table | Type | Phase | RLS | Purpose / size |
|---|---|---|---|---|
| `tenants` | OLTP | P1 | — | Root of multi-tenancy. Tiny — 1 row per enterprise customer. |
| `connectors` | OLTP | P2 | Yes | One row per Azure subscription per tenant. Small — 1–10 per tenant. |
| `cost_records` | TimescaleDB hypertable | P3 | Yes | Core FinOps data, biggest table. ~1 row per service per day per connector (e.g. 100 services × 30 days × 10 tenants = 30,000 rows/month). |
| `users` | OLTP | P2 | Yes | Mirrors Clerk users locally for RBAC/audit. Small — 1 row per user per tenant. |
| `audit_logs` | OLTP (append-only) | P2 | Yes | Immutable audit trail, no UPDATE/DELETE. Required for compliance export. |
| `budgets` | OLTP | POST-MVP | Yes | Budget definitions per tenant/subscription. Tiny — few rows per tenant. |

Column-level detail:

**`tenants`** (Phase P1): `id` (UUID PK), `clerk_org_id` (STRING UNIQUE — maps Clerk org →
internal tenant), `name` (STRING), `plan` (STRING), `created_at` (TIMESTAMP).

**`connectors`** (Phase P2): `id` (UUID PK), `tenant_id` (UUID FK → tenants, RLS column),
`subscription_id` (STRING), `display_name` (STRING), `status` (ENUM: active | failed | paused),
`last_synced_at` (TIMESTAMP), `created_at` (TIMESTAMP).

**`cost_records`** (Phase P3, TimescaleDB hypertable): `time` (TIMESTAMPTZ, partition key —
partitioned by day), `tenant_id` (UUID FK, RLS column), `connector_id` (UUID FK → connectors),
`service_name` (STRING), `amount` (FLOAT), `currency` (STRING), `subscription_id` (STRING,
denormalised), `resource_group` (STRING), `tags` (JSONB). TimescaleDB config: chunk interval 1
day; compression after 7 days; retention raw 90 days / aggregates 2 years; continuous aggregates
`daily_cost_by_service`, `monthly_cost_by_subscription`.

**`users`** (Phase P2): `id` (UUID PK), `tenant_id` (UUID FK, RLS column), `clerk_user_id`
(STRING UNIQUE), `email` (STRING, synced from Clerk webhook), `role` (ENUM: ADMIN | ANALYST |
VIEWER), `created_at` (TIMESTAMP).

**`audit_logs`** (Phase P2, append-only): `id` (UUID PK), `tenant_id` (UUID FK, RLS column),
`user_id` (UUID FK → users), `action` (STRING, e.g. `CONNECTOR_ADDED`, `SYNC_TRIGGERED`),
`resource_type` (STRING), `resource_id` (STRING), `timestamp` (TIMESTAMPTZ, immutable), `metadata`
(JSONB).

**`budgets`** (Phase POST-MVP): `id` (UUID PK), `tenant_id` (UUID FK, RLS column), `connector_id`
(UUID FK → connectors), `amount` (FLOAT), `period` (ENUM: monthly | quarterly | annual),
`alert_threshold` (FLOAT, e.g. 0.8 = 80%).

RLS policy per table:

| Table | Policy |
|---|---|
| tenants | No RLS needed — root table, no tenant_id FK |
| connectors | `tenant_id = current_setting('app.tenant_id')::uuid` |
| cost_records | `tenant_id = current_setting('app.tenant_id')::uuid` |
| users | `tenant_id = current_setting('app.tenant_id')::uuid` |
| audit_logs | `tenant_id = current_setting('app.tenant_id')::uuid` + NO DELETE |
| budgets | `tenant_id = current_setting('app.tenant_id')::uuid` |

### 2.2 Redis — cache layer

Host (production): Azure Cache for Redis (Standard). Local dev: Docker (`redis:7-alpine`, port
6379). Role: performance layer preventing repeated expensive DB queries on every dashboard load.

| Key Pattern | TTL | Data | Invalidation | Size | Phase |
|---|---|---|---|---|---|
| `cost:summary:{tenantId}` | 60 min | MTD total spend, top 5 services, % change vs last month | New ingestion batch completing | ~2 KB/tenant | P3 |
| `cost:daily:{tenantId}:{month}` | 60 min | Array of {date, amount} for 30-day trend chart | New ingestion batch completing | ~3 KB/tenant/month | P3 |
| `cost:services:{tenantId}` | 60 min | Service breakdown array for bar chart | New ingestion batch completing | ~4 KB/tenant | P3 |
| `tenant:{tenantId}:config` | 30 min | Tenant settings, connector list, plan details | On any tenant config change | ~1 KB/tenant | P2 |
| `session:{userId}` | 24 hr | User session data, resolved tenantId, role | On logout or role change | ~0.5 KB/user | P2 |
| `connector:status:{connectorId}` | 5 min | Last sync time, sync status, error if any | On each sync attempt | ~0.2 KB/connector | P3 |

Critical rules (as designed): Redis is NOT the source of truth; any Redis key can be deleted and
the system rebuilds from PostgreSQL; never store data in Redis that only exists in Redis; TTLs
are always defined per key pattern, never indefinite.

### 2.3 Clerk — identity store

Host: Clerk SaaS (managed), same in local dev. Role: owns all identity data — users,
organisations, sessions, SSO connections.

What is stored: user accounts (email, password hash, name, avatar — managed entirely by Clerk);
organisation (tenant) membership; SSO connections (Microsoft Entra ID OAuth tokens, Clerk handles
refresh); JWT sessions (short-lived, with userId/orgId/role claims, verified in NestJS); webhooks
(`user.created`, `org.created`, `membership.updated` → synced to the PostgreSQL `users` table).

Important: passwords are never stored by CloudGuard — Clerk owns them; only `clerk_user_id` and
`clerk_org_id` are stored as foreign keys; Clerk JWTs expire and are verified on every request;
profile changes sync via webhooks.

### 2.4 Azure Blob Storage — file store

Host: Azure Storage Account. Local dev: Azurite (optional for MVP). Role: stores generated files
— audit report PDFs and exported data.

What is stored: audit report PDFs (generated on demand, signed URL for download, never served
directly); cost export CSVs (bulk exports of `cost_records`); per-tenant container prefix
`audit-reports/{tenantId}/` for isolation; access pattern is NestJS generates PDF → uploads to
Blob → returns 1-hour signed URL.

Important: not used for application data, only generated file downloads; signed URLs expire, no
permanent public access; MVP could skip this — export feature was considered post-prototype;
per-tenant prefix enforces logical isolation at storage level.

### 2.5 Trigger.dev — job state

Host: Trigger.dev Cloud (managed SaaS). Local dev: Trigger.dev CLI + local dev server. Role:
stores job execution state — run history, retry attempts, payloads, logs.

What is stored: job run history (every `ingestAzureCosts` execution — status, duration, rows
ingested); retry state (failed attempts, backoff timers, error messages); job payloads
(`connectorId`, `subscriptionId`, `tenantId`); execution logs (per-step, for debugging).

Important: Trigger.dev is not the database — job outputs write to PostgreSQL; job state is for
operational visibility only, queried via the Trigger.dev dashboard, not from the app; ingested
data lands in `cost_records` (PostgreSQL), not in Trigger.dev.

### 2.6 Where each data type lives (summary)

| Data type | Store |
|---|---|
| User identity | Clerk |
| Tenant config | PostgreSQL + Redis |
| Azure credentials | Azure Key Vault |
| Cost records (raw) | TimescaleDB |
| Dashboard queries | Redis (cache) |
| Job run history | Trigger.dev |
| Audit trail | PostgreSQL (append-only) |
| Report PDFs | Azure Blob Storage |
| Sessions | Clerk + Redis |
| RBAC roles | PostgreSQL users table |

> The golden rule (as designed): "PostgreSQL is your system of record. Redis can always be
> flushed and rebuilt. Clerk owns identity. Everything else is derived."

---

## 3. Phases → Functional/Business Goals Mapping (from `phases_func_mapping.jsx`)

This section maps each of the five build phases (P0–P4) to the functional/business goal it was
meant to unlock — framed around user-facing outcomes rather than just codebase milestones.

### Phase 0 — Environment Setup (Pre-Day 1)
- **Functional goal:** Developer machine is a complete, verified CloudGuard 360 development
  environment.
- **Goal (short):** Ready to Code.
- **User story:** "As a developer, I can run the full stack locally with one command and connect
  to a real Azure subscription without writing any application code."
- **Tools:** Node.js 20 + pnpm, VS Code + extensions, Docker Desktop, PostgreSQL + TimescaleDB,
  Redis, Azure CLI (`az login`), Terraform, Git.
- **Deliverables (verify):** all 12 env checks pass; `docker compose up -d` runs clean;
  `az consumption usage list` returns real data; local DB accessible via Prisma Studio.
- **Functional goals met:** Azure connectivity from local machine; database ready (Docker);
  cache ready (Redis on 6379); build toolchain (TypeScript compiles, pnpm workspaces resolve).
- **Not yet:** no application code, no UI, no API, no multi-tenancy.
- **Stack layer:** Infrastructure Only.

### Phase 1 — Monorepo Scaffold (Days 1–3)
- **Functional goal:** A running monorepo where both apps start, share types, and connect to the
  database — with zero business logic.
- **Goal (short):** Skeleton Runs.
- **User story:** "As a developer, I can run both Next.js and NestJS simultaneously, import
  shared types between them, and see the database tables via Prisma Studio."
- **Tools:** Next.js 14 + App Router, NestJS 10, `packages/shared` (Zod), Prisma ORM, Turborepo,
  pnpm workspaces.
- **Deliverables (verify):** `pnpm dev` starts web (3000) + api (3001); no TypeScript errors
  across monorepo; Prisma Studio shows Tenant + Connector tables; `packages/shared` types
  importable in both apps.
- **Functional goals met:** project structure (apps/web, apps/api-byoc, packages/shared linked via
  pnpm workspaces); database schema (Tenant/Connector via Prisma migration); shared contracts
  (DTOs/Zod in packages/shared); dev server (hot reload, strict TypeScript).
- **Not yet:** no auth, no login UI, no Azure SDK calls, no real data, no business logic.
- **Stack layer:** Structure + Database.

### Phase 2 — Auth + Tenant + Connector (Days 4–10)
- **Functional goal:** A user can register, log in, and successfully connect their Azure
  subscription — with full multi-tenant isolation from day one.
- **Goal (short):** Login + Connect Azure.
- **User story:** "As an enterprise user, I can sign up, create my organisation, connect my Azure
  subscription ID, and see confirmation that CloudGuard 360 has verified access to my Azure Cost
  Management data."
- **Tools:** Clerk (Auth + SSO), NestJS AuthGuard/TenantGuard/RolesGuard,
  DefaultAzureCredential, `@azure/arm-costmanagement`.
- **Deliverables:** sign up/log in via Clerk (functional); Microsoft SSO/Entra ID works
  (functional); submit Azure Subscription ID → API verifies access (functional); connector saved
  with status active/failed (functional); all routes return 401 without valid JWT (security);
  all data scoped to tenant, no cross-tenant leakage (security).
- **Functional goals met:** user registration (Clerk email/password + SSO, zero custom auth
  code); multi-tenant foundation (Clerk orgId → internal tenantId via TenantGuard); Azure
  verification (DefaultAzureCredential confirms subscription access); security baseline
  (Auth+Tenant+Roles guards on every route); real Azure connection (first real API call, verified
  connector stored).
- **Not yet:** no cost data ingested yet, no dashboard charts, no jobs running, no cached data.
- **Stack layer:** Identity + Security + Azure Auth.

### Phase 3 — Real Data Pipeline (Days 11–18)
- **Functional goal:** Real Azure cost data flows automatically from the Azure Cost Management
  API into TimescaleDB and is served via cached API endpoints.
- **Goal (short):** Real Data Flowing.
- **User story:** "As a FinOps analyst, I can trigger an Azure cost sync and within minutes have
  real spend data available via API — correctly scoped to my tenant, cached in Redis, queryable
  by service, date, and subscription."
- **Tools:** Trigger.dev (TS jobs), `@azure/arm-costmanagement`, TimescaleDB hypertable, Prisma
  (OLTP), raw SQL (TimescaleDB), ioredis (caching).
- **Deliverables:** Trigger.dev job pulls real Azure cost data (functional); `GET
  /finops/summary` returns real MTD spend (functional); `GET /finops/daily` returns 30-day trend
  array (functional); `GET /finops/by-service` returns breakdown (functional); Redis caches
  responses with 1hr TTL (functional); second request returns in <10ms cache hit (performance);
  all data filtered by tenantId (security).
- **Functional goals met:** scheduled ingestion (hourly Trigger.dev job per connector);
  TimescaleDB storage (daily chunks, compressed after 7 days); cost summary API (MTD, top 5
  services, budget utilisation); trend API (30-day array for charting); performance layer (Redis
  caching per data type with TTLs); tenant isolation (every query includes `WHERE tenant_id =
  $tenantId`, no exceptions).
- **Not yet:** no UI charts yet, no frontend consuming this data, no anomaly detection, no
  Copilot.
- **Stack layer:** Data Pipeline + Storage + Cache.

### Phase 4 — Dashboard UI (Days 19–26)
- **Functional goal:** A real user can log in, connect Azure, trigger sync, and see their actual
  Azure costs in an interactive dashboard — prototype complete.
- **Goal (short):** Working Prototype.
- **User story:** "As an enterprise pilot user, I can open the browser, log in with my Microsoft
  account, add my Azure subscription, click Sync Now, and within minutes see my real Azure cloud
  spend broken down by service and date — with no mock data anywhere in the stack."
- **Tools:** Next.js App Router pages, tRPC, Recharts, shadcn/ui, Clerk (session UI),
  Server-Sent Events.
- **Deliverables:** login → dashboard redirect (functional); Add Connector form → Azure
  verification flow (functional); Sync Now → Trigger.dev job → data appears in UI (functional);
  cost summary card shows real MTD spend (functional); daily trend LineChart with real 30-day
  data (functional); service breakdown BarChart from real data (functional); second tenant sees
  no data from first tenant (security); all data is real, zero mocks in the stack (milestone).
- **Functional goals met:** end-to-end user flow (register → login → connect → sync → view);
  real cost visualisation (Recharts on real data); type-safe frontend (tRPC, TypeScript errors on
  any API mismatch); tenant isolation verified (two tabs, two orgs, zero crossover); full-stack
  real data (Azure SDK → TimescaleDB → Redis → NestJS → tRPC → Next.js → Charts); prototype
  complete (every architecture layer running with real Azure data).
- **Not yet:** anomaly detection (Month 2), Copilot/RAG (Month 2), compliance scanning (Month 3),
  Stripe billing (before GA).
- **Stack layer:** UI + End-to-End Integration.

### Key functional milestones (cross-phase)

| Phase | Milestone | Type |
|---|---|---|
| P0 | Can call Azure Cost Management API from local machine | infra |
| P1 | TypeScript monorepo compiles and both apps run simultaneously | structure |
| P2 | First secure, multi-tenant user session with verified Azure access | security |
| P3 | First real Azure cost record written to TimescaleDB | data |
| P3 | `GET /finops/summary` returns real numbers (not mock data) | data |
| P4 | Real user sees real Azure costs in browser — prototype complete | product |

**Full data flow at prototype completion (as envisioned):** Azure ARM API → DefaultAzureCredential
(P2) → Trigger.dev Job → TimescaleDB → Redis Cache → NestJS API (P3) → tRPC → Next.js → Recharts
(P4). Target: ~26 days from first command to working prototype.

---

## 4. Detailed Day-by-Day Roadmap (from `detailed_roadmap.jsx`)

This roadmap preserves the original phase structure with day ranges and the sub-navigation task
breakdown used in the slide deck (`p0`–`p4`, each with its own set of tabs).

### Phase 0 — Env Setup (Pre-Day 1)
Sub-nav tabs: **Accounts · Runtimes · VS Code · Docker · Azure CLI · Git & Terraform ·
Verification**

- **Accounts** — create all 6 accounts before installing any tooling (all free tiers sufficient
  for prototype): Microsoft Azure (real cost data, SDK target, Azure hosting), GitHub (source
  control, CI/CD via Actions), Clerk (auth, SSO, org management), Vercel (frontend hosting),
  Trigger.dev (TypeScript background jobs), Neon/Supabase (PostgreSQL cloud DB for local dev).
  Note: Azure account needs at least **Cost Management Reader** role; free Azure account includes
  $200 credit; note Subscription ID for Phase 2.
- **Runtimes** — Node.js 20.11.0 via NVM for Windows (never install Node directly from
  nodejs.org); pnpm as package manager (faster, less disk, standard for monorepos, used via
  workspaces throughout); TypeScript/ts-node/tsx installed globally.
- **VS Code** — required extensions: ESLint, Prettier, Prisma, Tailwind CSS IntelliSense,
  TypeScript Importer, REST Client (replaces Postman), Azure Tools, GitLens, Error Lens.
  Recommended `settings.json`: format on save, Prettier default formatter, relative import
  specifiers, auto-update imports on file move, ESLint fix-all on save.
- **Docker** — Docker Desktop runs PostgreSQL + TimescaleDB and Redis locally; never install
  these databases directly on Windows. `docker-compose.yml` defines `postgres`
  (`timescale/timescaledb:latest-pg16`, port 5432, db/user/password `cloudguard`/`cloudguard`/
  `localdev123`) and `redis` (`redis:7-alpine`, port 6379).
- **Azure CLI** — required for local dev with DefaultAzureCredential, the same auth mechanism
  used in production; local `az login` session IS the credential, no secrets needed locally.
  Critical: assign "Cost Management Reader" role to the account on the subscription via `az role
  assignment create`.
- **Git & Terraform** — configure git (`user.name`, `user.email`, `core.autocrlf false`,
  `init.defaultBranch main`); install Terraform (`winget install Hashicorp.Terraform`).
- **Verification** — 12 checks must all pass before writing product code: Node.js 20.x, pnpm
  8.x+, TypeScript 5.x, Docker Desktop running, PostgreSQL (Docker) on 5432, Redis (Docker) on
  6379, Azure CLI 2.57.x+, Azure login (subscription visible), Cost Management (returns usage
  rows), Git 2.43.x+, Terraform 1.7.x+, VS Code. Phase 0 complete when: all 12 checks green,
  `az consumption usage list --top 1` returns real data, `docker compose ps` shows both services
  running, ready to scaffold the monorepo.

### Phase 1 — Monorepo (Days 1–3)
Sub-nav tabs: **Structure · Scaffold Apps · Prisma · Env Files**

- **Structure** — goal: empty but fully configured monorepo where every tool works, linting
  passes, packages see each other's types, no business logic yet. Scaffold: `mkdir
  cloudguard360 && git init && pnpm init`. Directory structure: `apps/web` (Next.js 14 frontend,
  port 3000), `apps/api-byoc` (NestJS backend, port 3001), `packages/shared` (types/DTOs/Zod schemas
  used by both apps), `infra/` (Terraform files), plus `docker-compose.yml`,
  `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`. Add Turborepo (`pnpm add -D turbo -w`).
- **Scaffold Apps** — Next.js 14 via `pnpm create next-app@14 web --typescript --tailwind
  --eslint --app --src-dir --import-alias "@/*"`, plus `@clerk/nextjs`. NestJS via `pnpm dlx
  @nestjs/cli new api --package-manager pnpm`, plus `@nestjs/config`, `@nestjs/jwt`,
  `@nestjs/throttler`, `@prisma/client`, `@azure/arm-costmanagement`,
  `@azure/arm-resourcegraph`, `@azure/identity`, `ioredis`, `@trpc/server`, `zod`. Shared package
  `@cloudguard/shared` under `packages/shared` with Zod.
- **Prisma** — `pnpm dlx prisma init --datasource-provider postgresql`. Minimal Phase 1 schema:
  `Tenant` model (`id`, `clerkOrgId` unique, `name`, `createdAt`, relation to `connectors`) and
  `Connector` model (`id`, `tenantId`, relation to `Tenant`, `subscriptionId`, `displayName`,
  `status` default "active", `createdAt`). Run `prisma migrate dev --name init`, `prisma
  generate`, verify via `prisma studio`.
- **Env Files** — never commit `.env`/`.env.local`. `apps/api-byoc/.env`: `DATABASE_URL`,
  `REDIS_URL`, `CLERK_SECRET_KEY`, `AZURE_SUBSCRIPTION_ID`, `PORT=3001`. `apps/web/.env.local`:
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_API_URL`. Phase 1
  complete when: `pnpm dev` starts both apps without errors, Prisma Studio shows Tenant/Connector
  tables, `packages/shared` types importable from both apps, `tsc --noEmit` passes in each app.

### Phase 2 — Auth + Azure (Days 4–10)
Sub-nav tabs: **Clerk Setup · Auth Guards · Azure Connector · Done When**

- **Clerk Setup** — create Clerk app; enable Microsoft/Entra ID as social provider; create an
  Organisation (maps to a Tenant); copy Publishable/Secret keys to `.env` files; set redirect
  URLs for `localhost:3000` dev. `apps/web/src/middleware.ts` uses `clerkMiddleware` with a
  public-route matcher for `/`, `/sign-in(.*)`, `/sign-up(.*)`.
- **Auth Guards** — two guards run on every request. `AuthGuard` validates the Clerk JWT (reads
  bearer token, calls `clerkClient.verifyToken`, attaches `userId`/`orgId` to the request).
  `TenantGuard` resolves the internal `tenantId` from the Clerk `orgId` via `TenantService` and
  attaches it to the request context.
- **Azure Connector** — user provides Azure Subscription ID; API stores it then immediately
  verifies connectivity using `DefaultAzureCredential` + `CostManagementClient.query.usage`
  against a 1-day custom timeframe. `DefaultAzureCredential` locally = the developer's `az login`
  session (no secrets needed); in Azure Container Apps it resolves via Workload Identity
  automatically. Rule: never use `ClientSecretCredential`, never hardcode subscription secrets.
- **Done When** — checklist: user can sign up/log in via Clerk email/password; Microsoft SSO
  (Entra ID) login works; user can submit an Azure Subscription ID via a form; API calls
  DefaultAzureCredential, queries Cost Management, returns success/fail; connector record saved
  with status active/failed; all API routes return 401 without valid Clerk JWT; all data scoped
  to tenant, no cross-tenant leakage possible. Phase 2 complete when: first real Azure API call
  made using DefaultAzureCredential, multi-tenant foundation solid.

### Phase 3 — Data Pipeline (Days 11–18)
Sub-nav tabs: **TimescaleDB · Trigger.dev Job · API Endpoints · Redis Cache**

- **TimescaleDB** — enable extension via `CREATE EXTENSION IF NOT EXISTS timescaledb;` inside
  the local Postgres container. Add a `CostRecord` Prisma model (`id`, `tenantId`, `connectorId`,
  `time`, `serviceName`, `amount`, `currency` default "USD", `subscriptionId`, `resourceGroup`
  default "", `tags` Json, indexed on `[tenantId, time]`). Migrate, then convert to hypertable via
  `SELECT create_hypertable('CostRecord', 'time');` and optionally add a compression policy for
  chunks older than 7 days.
- **Trigger.dev Job** — install `@trigger.dev/sdk`, configure `TRIGGER_API_KEY` /
  `TRIGGER_API_URL`. Ingestion job `ingest-azure-costs` (in
  `apps/api-byoc/src/jobs/ingest-azure-costs.ts`) takes `{connectorId, subscriptionId, tenantId}`,
  authenticates via `DefaultAzureCredential`, calls `CostManagementClient.query.usage` with
  `MonthToDate` timeframe grouped by `ServiceName`, normalises and writes records to PostgreSQL,
  returns `{rowsIngested}`.
- **API Endpoints** — planned FinOps endpoints: `GET /finops/summary` (total MTD spend, top-5
  services, % vs last month), `GET /finops/daily` (30-day daily trend array), `GET
  /finops/by-service` (cost breakdown for bar chart), `GET /finops/connectors` (list with status
  and last sync), `POST /finops/connectors` (add new connector), `POST /finops/sync/:id`
  (trigger manual ingestion). Hard rule: all queries must include the `tenantId` filter — a
  `prisma.costRecord.findMany()` call with no `where: { tenantId }` is explicitly called out as
  "NEVER."
- **Redis Cache** — `ioredis`-based cache-aside pattern (`cost:summary:{tenantId}`, 1hr TTL,
  falls back to `computeSummary` on miss). Key patterns: `cost:summary:{tenantId}` /
  `cost:daily:{tenantId}` / `cost:services:{tenantId}` (60 min, invalidate on new ingestion
  batch), `connector:status:{id}` (5 min, invalidate each sync attempt). Phase 3 complete when:
  Trigger.dev job pulls real Azure cost data, `GET /finops/summary` returns real numbers, second
  request returns in <10ms (cache hit), all data filtered by `tenantId`.

### Phase 4 — Dashboard (Days 19–26)
Sub-nav tabs: **tRPC · Dashboard Pages · Libraries · End-to-End Test**

- **tRPC** — install `@trpc/server` in the API, `@trpc/client` + `@trpc/react-query` +
  `@tanstack/react-query` in the web app. Rationale given: without tRPC, response types must be
  manually kept in sync between frontend and backend; with tRPC, a field change in the NestJS
  router immediately surfaces as a TypeScript error in the React component — type safety flows
  PostgreSQL schema → Prisma → NestJS → tRPC → React component.
- **Dashboard Pages** — `/dashboard` (`CostSummaryCard` from `GET /finops/summary`,
  `DailyTrendChart` via Recharts LineChart from `GET /finops/daily`, `ServiceBreakdown` via
  Recharts BarChart from `GET /finops/by-service`); `/connectors` (`ConnectorList` from `GET
  /finops/connectors`); `/connectors/add` (`AddConnectorForm` posting to `POST
  /finops/connectors`); `/sign-in` (Clerk hosted UI, zero custom code).
- **Libraries** — `recharts` (charts), `@shadcn/ui` (components), `lucide-react` (icons),
  `date-fns` (date formatting), `axios` (HTTP client).
- **End-to-End Test** — manual walkthrough before declaring the prototype complete: open
  localhost:3000 → sign up → create an Organisation (= Tenant) → redirected to `/dashboard` (empty
  state) → navigate to `/connectors/add` → enter real Azure Subscription ID → click Connect (API
  verifies via DefaultAzureCredential) → connector saved as active → click "Sync Now" (triggers
  `ingestAzureCosts` job) → job pulls real Azure cost data into TimescaleDB → navigate to
  `/dashboard` → **real Azure costs visible in charts** → refresh (loads from Redis cache in
  <50ms) → open a second browser tab, log in as a different user/org → their dashboard shows no
  data from the first tenant, confirming isolation. Prototype complete when: real numbers appear
  in charts and tenant isolation is confirmed across tabs — full stack running (Next.js + NestJS
  + PostgreSQL + Redis + Trigger.dev + Azure SDK), zero mocks, zero hardcoded values, zero static
  JSON.

---

## 5. Business/Founder Planning (from Notion workspace script)

*(Source: `cloudguard-notion-setup/setup.js`, a one-off script that provisioned this content into
a real Notion workspace. The `workspace/*.js` stub files referenced by the script were empty
TODO placeholders and contained no real content.)*

### 5.1 Dashboard

"Solo founder daily hub · March 2026." MVP Phase 1 of 3. Pilot Customers target: 0/3. MRR: €0 →
target €5,000/month.

### 5.2 Roadmap (Notion database)

| Name | Status | Tag | Priority | Month |
|---|---|---|---|---|
| Azure Cost Management API connector | In Progress | MVP | High | Month 2 |
| Multi-subscription support | In Progress | MVP | High | Month 2 |
| Next.js + Tailwind scaffold | In Progress | MVP | High | Month 1 |
| Clerk auth + multi-tenancy | In Progress | MVP | High | Month 1 |
| Terraform Azure infra setup | In Progress | Infra | High | Month 1 |
| TimescaleDB schema design | Backlog | Infra | High | Month 1 |
| FinOps dashboard UI | Backlog | MVP | High | Month 3 |
| Budget alerts & anomaly detection | Backlog | MVP | Med | Month 4 |
| GDPR compliance module | Backlog | Phase 2 | Med | Month 7 |
| AI Copilot (Claude API) | Backlog | Phase 3 | Low | Month 10 |
| Stripe billing integration | Backlog | MVP | High | Month 5 |
| Azure Marketplace listing | Backlog | GTM | Med | Month 6 |
| Market research & validation | Done | Strategy | High | Month 1 |
| Tech stack decision | Done | Strategy | High | Month 1 |
| GitHub monorepo created | Done | Infra | High | Month 1 |

### 5.3 Sprint Board (Week 1–2)

Tasks tracked with the same structure as the roadmap (name/status/tag/priority): Docker Compose
setup, Deploy skeleton to Azure Container Apps, Azure Cost Management API connector,
Multi-subscription discovery, Next.js+Tailwind scaffold, Clerk auth flow, Multi-tenant DB schema
design, Terraform Azure infra modules, GitHub Actions CI/CD, Domain+SSL, Tech stack decision.

### 5.4 CRM

Sample/placeholder prospect rows only, spanning sectors Finance / Retail / Healthcare /
Manufacturing — illustrative template data, not real prospects.

### 5.5 Documents checklist

All entries status "Draft": Data Processing Agreement (DPA), Privacy Policy, Terms of Service,
Pilot Proposal Template, One-Pager, Architecture Decision Records, Pricing Strategy.

### 5.6 Architecture tech stack (Notion version — early, superseded)

> This is the same early stack captured in Section 1, as recorded separately in the Notion
> workspace script. It disagrees with the architecture slide deck on the backend framework
> (FastAPI/Python here vs. NestJS in the deck) — NestJS is what the current product actually
> uses, so this row should be read as an even earlier or parallel planning artifact.

| Layer | Choice |
|---|---|
| Frontend | Next.js + Tailwind + shadcn/ui on Vercel |
| Backend | **FastAPI (Python)** on Azure Container Apps |
| Database | PostgreSQL + **TimescaleDB** on Azure DB Flex Server |
| Cache | **Redis** on Azure Cache |
| Secrets | Azure Key Vault |
| Auth | Clerk + Entra SSO |
| Jobs | **Trigger.dev** |
| Billing | Stripe + Stripe Tax (pending) |
| IaC | Terraform |
| CI/CD | GitHub Actions |
| Monitoring | Sentry + Grafana (pending) |

**The current, real product** (per `docs/byoc/connect-azure.md` / repo `CLAUDE.md`) instead uses:
NestJS (not FastAPI/Python) as the backend, deployed **into the customer's own Azure tenant**
(not a CloudGuard-hosted Container App); plain Postgres via Prisma (no TimescaleDB yet); no
Redis; no Trigger.dev; Managed Identity auth (not just Clerk+Entra SSO) with no client secrets
ever entered or stored. This is a significant architectural pivot, not merely an implementation
detail.

### 5.7 KPIs

**Business:** MRR €0 → €5k/month by month 12; 0/3 pilot customers; 0 paying customers; churn N/A.

**Product:** MVP Phase 1/3 (15%); Azure Connector in progress; 0 features shipped this month.

**Founder:** 12h/week invested; 0/500 LinkedIn followers; 0 prospects contacted. A Weekly Log
template was included for ongoing tracking.

### 5.8 Ideas & Research

**Competitor analysis:**

| Competitor | Positioning noted |
|---|---|
| Apptio Cloudability | Expensive, complex, US-centric |
| CloudHealth by VMware | Enterprise-focused, costly |
| Azure Cost Management (native) | Clunky |
| Spot.io | Savings-only focus |

Identified gap: EU-focused, simpler UX, GDPR-native, affordable.

**Post-MVP feature ideas:** Slack/Teams daily cost digest bot; carbon footprint per resource;
chargeback/showback reporting; mobile app for alerts; Reserved Instance marketplace comparison;
multi-cloud expansion (AWS/GCP) as a Phase 3 item.

**Azure APIs to explore:** Reservations API, Hybrid Benefit calculator, Policy compliance API,
EA portal cost export, Carbon Optimization API, Cost Management exports (CSV/Parquet).

**Potential partnerships:** Azure Partner Network (MPN), Azure Paris user group, Station F
(Paris), French Tech accelerators (BPI France), European FinOps Foundation.

**Resources:** finops.org, Azure Cost Management docs, Stripe SaaS billing docs, Notion startup
templates.
