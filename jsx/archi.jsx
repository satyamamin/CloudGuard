import { useState } from "react";

/* ─── DESIGN SYSTEM ─────────────────────────────────────────────────────────
   Aesthetic: Dark technical blueprint — like a high-end systems diagram
   Fonts: Syne (display) + JetBrains Mono (code/data)
   Color: Deep navy base, electric cyan accent, amber warnings, green success
──────────────────────────────────────────────────────────────────────────── */

const C = {
  bg: "#04080F",
  surface: "#080E1A",
  card: "#0C1525",
  border: "#152035",
  borderBright: "#1E3550",
  cyan: "#00D4FF",
  cyanDim: "#00D4FF20",
  blue: "#1B6CA8",
  purple: "#7C3AED",
  green: "#00C896",
  amber: "#F59E0B",
  red: "#EF4444",
  text: "#E8F4FF",
  muted: "#4A6380",
  dim: "#1A2840",
};

const NAV_ITEMS = [
  { id: "overview",     label: "Overview",      icon: "◈", short: "OVR" },
  { id: "hld",          label: "Architecture",  icon: "⬡", short: "HLD" },
  { id: "stack",        label: "Tech Stack",    icon: "⬢", short: "STK" },
  { id: "data",         label: "Data Layer",    icon: "◉", short: "DAT" },
  { id: "pipeline",     label: "Ingestion",     icon: "⟶", short: "ING" },
  { id: "security",     label: "Security",      icon: "⬛", short: "SEC" },
  { id: "ai",           label: "AI / Copilot",  icon: "✦", short: "AI"  },
  { id: "cicd",         label: "CI/CD & Infra", icon: "⚙", short: "OPS" },
  { id: "nfr",          label: "NFR & Risks",   icon: "◆", short: "NFR" },
  { id: "adr",          label: "Decisions",     icon: "◧", short: "ADR" },
];

/* ─── SHARED COMPONENTS ──────────────────────────────────────────────────── */

const Tag = ({ children, color = C.cyan }) => (
  <span style={{
    fontSize: 10, padding: "2px 8px", borderRadius: 3, fontFamily: "JetBrains Mono, monospace",
    background: color + "20", color, border: `1px solid ${color}40`, letterSpacing: "0.06em",
    display: "inline-block", marginRight: 4, marginBottom: 2,
  }}>{children}</span>
);

const SectionHeader = ({ title, sub, accent = C.cyan }) => (
  <div style={{ marginBottom: 24, borderBottom: `1px solid ${accent}30`, paddingBottom: 16 }}>
    <div style={{ fontSize: 10, color: accent, letterSpacing: "0.2em", fontFamily: "JetBrains Mono, monospace", marginBottom: 6, fontWeight: 700 }}>
      {sub}
    </div>
    <h2 style={{ margin: 0, fontSize: 26, fontFamily: "Syne, sans-serif", fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}>
      {title}
    </h2>
  </div>
);

const InfoCard = ({ title, value, accent = C.cyan, wide = false }) => (
  <div style={{
    background: C.card, border: `1px solid ${accent}30`, borderLeft: `3px solid ${accent}`,
    borderRadius: 8, padding: "14px 16px", gridColumn: wide ? "1 / -1" : undefined,
  }}>
    <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 6 }}>{title}</div>
    <div style={{ fontSize: 13, color: C.text, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.6 }}>{value}</div>
  </div>
);

const CodeBlock = ({ children, accent = "#00D4FF" }) => (
  <div style={{
    background: "#020509", border: `1px solid ${accent}25`, borderRadius: 8,
    padding: "14px 16px", margin: "10px 0", overflowX: "auto",
  }}>
    <pre style={{ margin: 0, fontSize: 11, color: "#7DD3FC", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
      {children}
    </pre>
  </div>
);

const Table = ({ headers, rows, accent = C.cyan }) => (
  <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${C.border}` }}>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: accent + "18" }}>
          {headers.map((h, i) => (
            <th key={i} style={{
              padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 800,
              color: accent, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.1em",
              borderBottom: `1px solid ${accent}30`,
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? C.card : C.surface }}>
            {row.map((cell, j) => (
              <td key={j} style={{
                padding: "9px 14px", fontSize: 11, color: j === 0 ? C.text : C.muted,
                fontFamily: "JetBrains Mono, monospace", lineHeight: 1.5,
                borderBottom: `1px solid ${C.border}`,
                fontWeight: j === 0 ? 600 : 400,
              }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* ─── PAGES ──────────────────────────────────────────────────────────────── */

function OverviewPage() {
  const principles = [
    { title: "Multi-Tenant SaaS", desc: "Each enterprise is a fully isolated tenant from day one — isolation enforced at auth, application, and database layers simultaneously.", icon: "⬡" },
    { title: "Modular Monolith", desc: "Single deployable unit with clean module boundaries. Designed for future microservice extraction when the team and load demands it.", icon: "⬢" },
    { title: "TypeScript Everywhere", desc: "Frontend, backend, jobs, shared contracts — one language, one compiler, one type system across the entire stack.", icon: "◈" },
    { title: "Cloud-Agnostic Core", desc: "Azure connectors in MVP. Architecture supports AWS and GCP connectors via the same adapter pattern with no core changes.", icon: "◉" },
    { title: "AI-Ready from Day One", desc: "Copilot and anomaly detection are not bolted on — they are first-class modules built into the architecture from the start.", icon: "✦" },
    { title: "Security-First Design", desc: "DefaultAzureCredential, Workload Identity, PostgreSQL RLS, WAF — security layered at every tier, not added at the end.", icon: "⬛" },
  ];

  const actors = [
    { role: "Enterprise Admin", actions: "Onboards subscriptions, configures budgets and policies", color: C.cyan },
    { role: "FinOps Analyst", actions: "Reviews dashboards, anomalies, cost trends, forecasts", color: C.green },
    { role: "Security Officer", actions: "Reviews audit reports, PII scan results, policy violations", color: C.amber },
    { role: "Copilot User", actions: "Natural language Q&A over connected accounts and findings", color: C.purple },
    { role: "Azure Platform", actions: "Source of cost, resource, advisor, and monitor telemetry", color: "#1B6CA8" },
    { role: "Clerk", actions: "Identity, SSO (Microsoft Entra ID), org membership management", color: "#8B5CF6" },
    { role: "Stripe", actions: "Subscription billing, invoices, enterprise plan management", color: "#635BFF" },
  ];

  const scope = [
    "Azure Connector — cost management, resource graph, advisor, monitor",
    "FinOps Dashboard — real-time cost visibility per subscription / tag / region",
    "Cost Anomaly Detection — with root-cause hints and alerts",
    "Budget Alerts & Forecasting — threshold-based with Resend email notifications",
    "Storage PII Scanning — data residency policy compliance checks",
    "Audit Report Export — PDF and CSV via Azure Blob signed URLs",
    "Copilot Q&A — natural language over connected accounts and findings (RAG)",
  ];

  return (
    <div>
      <SectionHeader title="CloudGuard 360" sub="EXECUTIVE SUMMARY · SYSTEM OVERVIEW" accent={C.cyan} />

      <div style={{
        background: `linear-gradient(135deg, ${C.cyan}10, ${C.purple}08)`,
        border: `1px solid ${C.cyan}30`, borderRadius: 12, padding: "20px 24px", marginBottom: 28,
      }}>
        <p style={{ margin: 0, fontSize: 14, color: C.text, lineHeight: 1.8, fontFamily: "JetBrains Mono, monospace" }}>
          CloudGuard 360 is a <span style={{ color: C.cyan }}>multi-tenant SaaS platform</span> delivering unified FinOps and cloud governance for enterprise Azure environments.
          It provides real-time cost visibility, anomaly detection, compliance monitoring, and AI-powered Q&A — all from a single dashboard with enterprise-grade
          security and <span style={{ color: C.green }}>zero cross-tenant data leakage</span>.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 10, color: C.cyan, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
            CORE DESIGN PRINCIPLES
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {principles.map((p, i) => (
              <div key={i} style={{
                display: "flex", gap: 12, padding: "12px 14px",
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
              }}>
                <span style={{ color: C.cyan, fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{p.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: "Syne, sans-serif", marginBottom: 3 }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: C.muted, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.6 }}>{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, color: C.green, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
            MVP SCOPE — 7 CAPABILITY AREAS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
            {scope.map((s, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, padding: "10px 14px",
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 7,
                alignItems: "flex-start",
              }}>
                <span style={{ color: C.green, fontSize: 12, flexShrink: 0, marginTop: 2, fontFamily: "JetBrains Mono, monospace" }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ fontSize: 11, color: C.muted, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.5 }}>{s}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 10, color: C.amber, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
            SYSTEM ACTORS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {actors.map((a, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, padding: "8px 12px",
                background: C.card, border: `1px solid ${a.color}20`,
                borderLeft: `3px solid ${a.color}`, borderRadius: 6,
              }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: a.color, fontFamily: "JetBrains Mono, monospace" }}>{a.role}</span>
                  <span style={{ fontSize: 10, color: C.muted, fontFamily: "JetBrains Mono, monospace" }}> — {a.actions}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HLDPage() {
  const layers = [
    { name: "Edge & Security", components: "Azure Front Door + WAF", responsibility: "Global entry point, DDoS protection, WAF rules, SSL termination, geo-routing", color: C.red },
    { name: "Presentation", components: "Next.js 14 on Vercel", responsibility: "SSR/CSR dashboard, App Router, Tailwind + shadcn/ui component library", color: C.cyan },
    { name: "API", components: "NestJS on Azure Container Apps", responsibility: "REST + tRPC, Auth/Tenant/Role guards, business logic, orchestration", color: C.blue },
    { name: "Data", components: "PostgreSQL + TimescaleDB + Redis + pgvector", responsibility: "OLTP persistence, time-series cost data, caching, vector embeddings for RAG", color: C.green },
    { name: "Integration", components: "Azure SDK + Service Bus + Trigger.dev", responsibility: "Azure telemetry ingestion, async job processing, circuit breaking", color: C.amber },
  ];

  const deployment = [
    ["Frontend", "Vercel Edge Network", "Automatic (CDN)", "Global"],
    ["API (NestJS)", "Azure Container Apps", "Min 1, Max 10 replicas", "West Europe"],
    ["PostgreSQL", "Azure DB for PostgreSQL Flexible Server", "Vertical + Read Replicas", "West Europe + DR"],
    ["Redis", "Azure Cache for Redis", "Standard tier, clustered", "West Europe"],
    ["Service Bus", "Azure Service Bus (Standard)", "Partitioned topics", "West Europe"],
    ["Jobs (Trigger.dev)", "Trigger.dev Cloud", "Managed, auto-scale workers", "Managed SaaS"],
    ["Secrets", "Azure Key Vault", "N/A (managed service)", "West Europe"],
    ["Observability", "Azure Monitor + Grafana", "N/A (managed)", "Global"],
  ];

  const tenancyLayers = [
    { layer: "Layer 1 — Authentication", detail: "Clerk org membership validates tenant identity on every request", color: C.red },
    { layer: "Layer 2 — Application", detail: "NestJS TenantGuard injects tenantId into all service calls, blocking cross-tenant access at application level", color: C.amber },
    { layer: "Layer 3 — Database", detail: "PostgreSQL RLS policies enforce tenant isolation at the database engine level — non-bypassable", color: C.green },
  ];

  return (
    <div>
      <SectionHeader title="High-Level Architecture" sub="HLD · SYSTEM LAYERS · DEPLOYMENT · MULTI-TENANCY" accent={C.cyan} />

      {/* Architecture flow diagram */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: C.cyan, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
          ARCHITECTURE LAYERS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {layers.map((l, i) => (
            <div key={i}>
              <div style={{
                display: "grid", gridTemplateColumns: "160px 220px 1fr",
                background: i % 2 === 0 ? C.card : C.surface,
                border: `1px solid ${l.color}25`,
                borderLeft: `4px solid ${l.color}`,
                padding: "14px 18px", gap: 16,
                borderRadius: i === 0 ? "8px 8px 0 0" : i === layers.length - 1 ? "0 0 8px 8px" : 0,
              }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: l.color, fontFamily: "Syne, sans-serif" }}>{l.name}</div>
                <div style={{ fontSize: 11, color: C.text, fontFamily: "JetBrains Mono, monospace" }}>{l.components}</div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.5 }}>{l.responsibility}</div>
              </div>
              {i < layers.length - 1 && (
                <div style={{ display: "flex", justifyContent: "center", margin: "0", background: C.dim, height: 2 }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Full flow diagram */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: C.amber, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
          FULL DATA FLOW DIAGRAM
        </div>
        <CodeBlock accent={C.amber}>{`[Azure Subscriptions]
  │  Azure SDK (arm-costmanagement, arm-resourcegraph, arm-advisor, arm-monitor)
  ▼
[Azure Service Bus]  ←── ingestion queue, async decoupling, retry support
  │
  ▼
[Trigger.dev Workers]  ←── TypeScript job consumers, scheduled ingestion tasks
  │
  ▼
[NestJS API — Azure Container Apps]
  Guards: Auth │ Tenant │ Roles
  Modules: FinOps │ Anomaly │ Copilot │ Compliance │ Billing
  Circuit Breaker (cockatiel) on all Azure SDK calls
  │                    │                    │
  ▼                    ▼                    ▼
[PostgreSQL +      [Redis Cache]       [pgvector — RAG]
 TimescaleDB]       TTL-defined         embeddings for
 RLS per tenant     per data type       Copilot Q&A
  │
  ▼
[Azure OpenAI]  ←── Copilot inference, anomaly root-cause hints

[Next.js — Vercel]  ◄──►  REST + tRPC  ◄──►  [NestJS API]
         ▲
         │
[Azure Front Door + WAF]  ←── global edge, WAF, DDoS, SSL
[Clerk]   ←── Auth, SSO/Entra ID, tenant org management
[Stripe]  ←── billing, invoices, subscription plans
[Sentry]  ←── error tracking (frontend + backend)
[OpenTelemetry → Azure Monitor → Grafana]  ←── observability`}</CodeBlock>
      </div>

      {/* Deployment */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: C.green, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
          DEPLOYMENT ARCHITECTURE
        </div>
        <Table
          headers={["Component", "Platform", "Scaling", "Region"]}
          rows={deployment}
          accent={C.green}
        />
      </div>

      {/* Multi-tenancy */}
      <div>
        <div style={{ fontSize: 10, color: C.purple, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
          MULTI-TENANCY — THREE-LAYER ISOLATION MODEL
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {tenancyLayers.map((t, i) => (
            <div key={i} style={{
              display: "flex", gap: 14, padding: "14px 18px",
              background: C.card, border: `1px solid ${t.color}30`,
              borderLeft: `4px solid ${t.color}`, borderRadius: 8,
            }}>
              <span style={{ fontSize: 22, color: t.color, flexShrink: 0 }}>0{i + 1}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.color, fontFamily: "Syne, sans-serif", marginBottom: 4 }}>{t.layer}</div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.6 }}>{t.detail}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{
          background: `${C.green}10`, border: `1px solid ${C.green}30`, borderRadius: 10, padding: "14px 18px",
        }}>
          <div style={{ fontSize: 10, color: C.green, letterSpacing: "0.12em", fontFamily: "JetBrains Mono, monospace", fontWeight: 700, marginBottom: 6 }}>
            ◆ TENANT ISOLATION GUARANTEE
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#6EE7B7", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.7 }}>
            Even if application-level guards are bypassed (e.g. due to a bug), PostgreSQL RLS policies ensure
            that no query can return rows from a different tenant. This is the defence-in-depth principle applied to data isolation.
          </p>
        </div>
      </div>
    </div>
  );
}

function StackPage() {
  const [activeTab, setActiveTab] = useState("frontend");

  const tabs = [
    { id: "frontend", label: "Frontend", color: C.cyan },
    { id: "backend", label: "Backend", color: C.blue },
    { id: "modules", label: "NestJS Modules", color: C.purple },
    { id: "pipeline", label: "Request Pipeline", color: C.green },
  ];

  const frontendStack = [
    ["Next.js", "14 — App Router, RSC", "SSR, routing, API routes"],
    ["TypeScript", "5.x — strict mode", "Type safety everywhere"],
    ["Tailwind CSS", "3.x — JIT", "Utility-first styling"],
    ["shadcn/ui", "Latest — Radix primitives", "Accessible component library"],
    ["tRPC Client", "10.x — React Query adapter", "Type-safe internal API calls"],
    ["Clerk (Next.js SDK)", "Latest", "Auth middleware, session management"],
    ["Recharts / D3", "Latest", "Cost charts, trend visualisation"],
    ["Vercel", "Edge Network", "Hosting, Edge Functions, ISR"],
  ];

  const backendStack = [
    ["NestJS", "10.x — modular monolith", "Backend framework, DI container"],
    ["TypeScript", "5.x — strict mode", "Type safety, shared contracts"],
    ["Prisma ORM", "5.x", "OLTP queries, migrations, schema"],
    ["tRPC Server", "10.x", "Type-safe procedures for internal UI"],
    ["Clerk (Node SDK)", "Latest", "JWT verification, user/org management"],
    ["Pino", "8.x", "Structured JSON logging"],
    ["OpenTelemetry", "@opentelemetry/sdk-node", "Distributed tracing, metrics export"],
    ["cockatiel", "3.x", "Circuit breaker for Azure SDK calls"],
    ["Azure Container Apps", "Consumption plan", "Hosting, auto-scaling, Workload Identity"],
  ];

  const modules = [
    { name: "AuthModule", services: "AuthGuard, TenantGuard, RolesGuard", responsibility: "JWT validation, tenant resolution, RBAC enforcement on every request", color: C.red },
    { name: "TenantModule", services: "TenantService, TenantResolver", responsibility: "Tenant lifecycle, Clerk orgId → internal tenantId mapping, provisioning", color: C.purple },
    { name: "ConnectorModule", services: "ConnectorService, AzureAdapterService", responsibility: "Azure subscription management, credential storage, health checks, SDK calls", color: C.blue },
    { name: "FinOpsModule", services: "CostService, BudgetService, ForecastService", responsibility: "Cost aggregation on TimescaleDB, budget CRUD, forecast computation", color: C.cyan },
    { name: "AnomalyModule", services: "AnomalyDetectionService, AlertService", responsibility: "Statistical anomaly detection, root-cause attribution, Resend email alerts", color: C.amber },
    { name: "CopilotModule", services: "CopilotService, EmbeddingService, RAGService", responsibility: "Query processing, context retrieval from pgvector, Azure OpenAI, SSE streaming", color: "#A855F7" },
    { name: "ComplianceModule", services: "PIIScanService, AuditService, ReportService", responsibility: "Storage PII scanning, residency policy checks, audit log, PDF report export", color: C.green },
    { name: "BillingModule", services: "StripeWebhookService, SubscriptionService", responsibility: "Stripe webhook handling, subscription state management, invoice sync", color: "#635BFF" },
    { name: "IngestionModule", services: "ServiceBusConsumer, IngestionPipeline", responsibility: "Azure Service Bus message consumption, data normalisation, TimescaleDB writes", color: C.amber },
  ];

  const requestSteps = [
    { step: "01", action: "Request arrives at NestJS HTTP adapter", layer: "Transport" },
    { step: "02", action: "Helmet middleware applies security headers", layer: "Middleware" },
    { step: "03", action: "Rate limiter checks request frequency per IP and tenant", layer: "Middleware" },
    { step: "04", action: "AuthGuard validates Clerk JWT, extracts userId and orgId", layer: "Guard" },
    { step: "05", action: "TenantGuard resolves internal tenantId from orgId, attaches to request", layer: "Guard" },
    { step: "06", action: "RolesGuard checks user role against decorator-defined requirements", layer: "Guard" },
    { step: "07", action: "Route handler / tRPC procedure executes with tenantId in context", layer: "Handler" },
    { step: "08", action: "All Prisma queries automatically include WHERE tenant_id = $tenantId", layer: "ORM" },
    { step: "09", action: "PostgreSQL RLS enforces tenant_id filter at database engine level", layer: "Database" },
    { step: "10", action: "Response serialised and returned; OpenTelemetry span closed", layer: "Response" },
  ];

  const stepColors = { Transport: C.muted, Middleware: C.amber, Guard: C.red, Handler: C.cyan, ORM: C.blue, Database: C.green, Response: C.muted };

  const pages = [
    ["/dashboard", "FinOps Overview", "Cost summary, top services, trend chart, budget status"],
    ["/dashboard/anomalies", "Anomaly Detection", "Detected anomalies with severity, service, root-cause hint"],
    ["/dashboard/budgets", "Budgets & Alerts", "Budget config, forecast vs actual, alert thresholds"],
    ["/dashboard/compliance", "Compliance", "PII scan results, residency violations, audit logs"],
    ["/copilot", "AI Copilot", "Chat interface for natural language queries over connected accounts"],
    ["/settings/connectors", "Azure Connectors", "Add/manage Azure subscriptions, credential health status"],
    ["/settings/billing", "Billing", "Stripe subscription management, invoice history"],
    ["/reports", "Reports", "Export audit reports as PDF/CSV"],
  ];

  return (
    <div>
      <SectionHeader title="Technology Stack" sub="LLD · FRONTEND · BACKEND · MODULES · REQUEST PIPELINE" accent={C.blue} />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: "8px 18px", border: "none", cursor: "pointer", fontFamily: "JetBrains Mono, monospace",
            fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", borderRadius: "6px 6px 0 0",
            background: activeTab === t.id ? t.color + "20" : "transparent",
            color: activeTab === t.id ? t.color : C.muted,
            borderBottom: activeTab === t.id ? `2px solid ${t.color}` : "2px solid transparent",
            transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>

      {activeTab === "frontend" && (
        <div>
          <Table headers={["Technology", "Version / Config", "Purpose"]} rows={frontendStack} accent={C.cyan} />
          <div style={{ marginTop: 24, fontSize: 10, color: C.cyan, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
            APPLICATION ROUTES
          </div>
          <Table headers={["Route", "Module", "Description"]} rows={pages} accent={C.cyan} />
        </div>
      )}

      {activeTab === "backend" && (
        <Table headers={["Technology", "Version / Config", "Purpose"]} rows={backendStack} accent={C.blue} />
      )}

      {activeTab === "modules" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {modules.map((m, i) => (
            <div key={i} style={{
              background: C.card, border: `1px solid ${m.color}25`,
              borderLeft: `4px solid ${m.color}`, borderRadius: 8, padding: "14px 18px",
              display: "grid", gridTemplateColumns: "180px 220px 1fr", gap: 16, alignItems: "start",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: m.color, fontFamily: "Syne, sans-serif" }}>{m.name}</div>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.6 }}>{m.services}</div>
              <div style={{ fontSize: 11, color: C.text, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.6 }}>{m.responsibility}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "pipeline" && (
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {requestSteps.map((s, i) => (
              <div key={i} style={{
                display: "flex", gap: 14, padding: "12px 16px",
                background: i % 2 === 0 ? C.card : C.surface,
                border: `1px solid ${C.border}`, borderRadius: 6,
                alignItems: "center",
              }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: stepColors[s.layer] + "60", fontFamily: "Syne, sans-serif", minWidth: 32 }}>{s.step}</span>
                <Tag color={stepColors[s.layer]}>{s.layer}</Tag>
                <span style={{ fontSize: 11, color: C.text, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.5 }}>{s.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DataPage() {
  const [activeTable, setActiveTable] = useState(null);

  const tables = [
    {
      name: "tenants", type: "OLTP", color: C.cyan,
      columns: [
        ["id", "UUID PK", "Root isolation boundary"],
        ["clerk_org_id", "STRING UNIQUE", "Maps Clerk org → internal tenant"],
        ["name", "STRING", "Enterprise customer name"],
        ["plan", "STRING", "Subscription plan tier"],
        ["created_at", "TIMESTAMP", "Tenant creation date"],
      ],
      notes: "Root isolation boundary. No tenant_id FK needed. 1 row per enterprise customer.",
    },
    {
      name: "connectors", type: "OLTP · RLS", color: C.blue,
      columns: [
        ["id", "UUID PK", "Connector identifier"],
        ["tenant_id", "UUID FK", "RLS policy column"],
        ["cloud", "STRING", "azure | aws | gcp"],
        ["subscription_id", "STRING", "Azure Subscription ID"],
        ["status", "ENUM", "active | failed | paused"],
      ],
      notes: "One row per Azure subscription per tenant. Credentials referenced in Key Vault, not stored here.",
    },
    {
      name: "cost_records", type: "TIMESCALEDB HYPERTABLE · RLS", color: C.green,
      columns: [
        ["time", "TIMESTAMPTZ (partition)", "Partitioned by day — TimescaleDB"],
        ["tenant_id", "UUID FK", "RLS policy column"],
        ["connector_id", "UUID FK", "Which Azure subscription"],
        ["service_name", "STRING", "e.g. Virtual Machines, Storage"],
        ["amount", "FLOAT", "Cost in currency units"],
        ["currency", "STRING", "USD, EUR etc."],
        ["tags", "JSONB", "Azure resource tags for filtering"],
      ],
      notes: "Core FinOps data. Partitioned by day. Compression after 7 days. 90-day raw retention.",
      timescale: true,
    },
    {
      name: "anomalies", type: "OLTP · RLS", color: C.amber,
      columns: [
        ["id", "UUID PK", "Anomaly identifier"],
        ["tenant_id", "UUID FK", "RLS policy column"],
        ["detected_at", "TIMESTAMP", "When anomaly was detected"],
        ["service", "STRING", "Affected Azure service"],
        ["severity", "ENUM", "low | medium | high | critical"],
        ["root_cause", "TEXT", "AI-generated root-cause hint"],
        ["status", "ENUM", "open | acknowledged | resolved"],
      ],
      notes: "Populated post-ingestion by AnomalyDetectionService. Z-score + rolling baseline algorithm.",
    },
    {
      name: "budgets", type: "OLTP · RLS", color: C.cyan,
      columns: [
        ["id", "UUID PK", "Budget identifier"],
        ["tenant_id", "UUID FK", "RLS policy column"],
        ["connector_id", "UUID FK", "Scoped to subscription"],
        ["amount", "FLOAT", "Budget ceiling"],
        ["period", "ENUM", "monthly | quarterly | annual"],
        ["alert_threshold", "FLOAT", "Alert % (e.g. 0.80 = 80%)"],
      ],
      notes: "Alert % triggers Resend email via AnomalyModule when spend crosses threshold.",
    },
    {
      name: "audit_logs", type: "OLTP APPEND-ONLY · RLS", color: C.purple,
      columns: [
        ["id", "UUID PK", "Log entry identifier"],
        ["tenant_id", "UUID FK", "RLS policy column"],
        ["user_id", "UUID FK", "Who performed the action"],
        ["action", "STRING", "e.g. CONNECTOR_ADDED, SYNC_TRIGGERED"],
        ["resource_type", "STRING", "e.g. connector, budget"],
        ["timestamp", "TIMESTAMPTZ", "Immutable — no UPDATE allowed"],
        ["metadata", "JSONB", "Additional context"],
      ],
      notes: "Immutable. No UPDATE or DELETE permissions granted on this table. 90-day retention.",
    },
    {
      name: "copilot_embeddings", type: "PGVECTOR · RLS", color: C.purple,
      columns: [
        ["id", "UUID PK", "Embedding identifier"],
        ["tenant_id", "UUID FK", "RLS policy column — isolation for RAG"],
        ["source_type", "STRING", "cost_record | anomaly | finding"],
        ["source_id", "UUID", "Reference to originating record"],
        ["embedding", "vector(1536)", "Azure OpenAI text-embedding-3-small output"],
        ["content", "TEXT", "Original text chunk"],
      ],
      notes: "HNSW index for approximate nearest-neighbour search. Chunk size: 512 tokens with 64-token overlap.",
    },
    {
      name: "users", type: "OLTP · RLS", color: C.muted,
      columns: [
        ["id", "UUID PK", "Internal user identifier"],
        ["tenant_id", "UUID FK", "RLS policy column"],
        ["clerk_user_id", "STRING UNIQUE", "Maps Clerk user → internal user"],
        ["email", "STRING", "Synced from Clerk webhooks"],
        ["role", "ENUM", "ADMIN | ANALYST | VIEWER"],
      ],
      notes: "Synced from Clerk webhooks. Roles drive NestJS RolesGuard access control.",
    },
  ];

  const cacheKeys = [
    ["cost:{tenantId}:{period}", "Aggregated cost data", "60 min", "On new ingestion batch"],
    ["budget:{tenantId}:{budgetId}", "Budget + current spend", "5 min", "On budget update"],
    ["anomaly:{tenantId}:list", "Active anomalies list", "10 min", "On anomaly detection run"],
    ["tenant:{tenantId}:config", "Tenant settings, connectors", "30 min", "On tenant config change"],
    ["session:{userId}", "User session data", "24 hr", "On logout or role change"],
    ["copilot:ctx:{tenantId}:{hash}", "RAG retrieval cache", "15 min", "On new embeddings indexed"],
  ];

  return (
    <div>
      <SectionHeader title="Data Layer" sub="LLD · POSTGRESQL · TIMESCALEDB · REDIS · RLS" accent={C.green} />

      <div style={{ display: "flex", gap: 20 }}>
        {/* Table list */}
        <div style={{ width: 180, flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.14em", fontFamily: "JetBrains Mono, monospace", marginBottom: 10 }}>TABLES</div>
          {tables.map(t => (
            <button key={t.name} onClick={() => setActiveTable(activeTable === t.name ? null : t.name)} style={{
              width: "100%", textAlign: "left", cursor: "pointer",
              padding: "8px 12px", marginBottom: 4, borderRadius: 6, border: "none",
              background: activeTable === t.name ? t.color + "20" : C.card,
              borderLeft: `3px solid ${activeTable === t.name ? t.color : C.border}`,
              transition: "all 0.14s",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: activeTable === t.name ? t.color : C.text, fontFamily: "JetBrains Mono, monospace" }}>{t.name}</div>
              <div style={{ fontSize: 9, color: C.muted, fontFamily: "JetBrains Mono, monospace", marginTop: 2, lineHeight: 1.3 }}>{t.type}</div>
            </button>
          ))}
        </div>

        {/* Table detail */}
        <div style={{ flex: 1 }}>
          {activeTable ? (() => {
            const t = tables.find(x => x.name === activeTable);
            return (
              <div>
                <div style={{
                  background: C.card, border: `1px solid ${t.color}40`,
                  borderRadius: 10, padding: "18px 20px", marginBottom: 16,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: t.color, fontFamily: "Syne, sans-serif" }}>{t.name}</div>
                    <Tag color={t.color}>{t.type}</Tag>
                  </div>
                  <p style={{ margin: "0 0 14px", fontSize: 11, color: C.muted, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.7 }}>{t.notes}</p>
                  <Table headers={["Column", "Type", "Notes"]} rows={t.columns} accent={t.color} />
                  {t.timescale && (
                    <CodeBlock accent={C.green}>{`-- TimescaleDB Setup
SELECT create_hypertable('cost_records', 'time');
-- Chunk interval: 1 day
-- Compression: chunks older than 7 days
-- Continuous aggregates: daily_cost_by_service, monthly_cost_by_subscription
-- Retention: raw 90 days | aggregates 2 years`}</CodeBlock>
                  )}
                </div>
                {t.type.includes("RLS") && (
                  <CodeBlock accent={C.purple}>{`-- RLS Policy Pattern
ALTER TABLE ${t.name} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${t.name} FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON ${t.name}
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Application sets this before every query:
SET LOCAL app.tenant_id = '{tenantId}';`}</CodeBlock>
                )}
              </div>
            );
          })() : (
            <div>
              <div style={{
                background: `${C.green}08`, border: `1px solid ${C.green}25`,
                borderRadius: 10, padding: "16px 20px", marginBottom: 20,
              }}>
                <div style={{ fontSize: 11, color: C.green, fontFamily: "JetBrains Mono, monospace", marginBottom: 8, fontWeight: 700 }}>← SELECT A TABLE</div>
                <p style={{ margin: 0, fontSize: 11, color: C.muted, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.7 }}>
                  Click any table on the left to see its full column definitions, RLS policy, and TimescaleDB configuration.
                </p>
              </div>
              <div style={{ fontSize: 10, color: C.amber, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
                REDIS CACHING STRATEGY
              </div>
              <Table
                headers={["Key Pattern", "Data", "TTL", "Invalidation Trigger"]}
                rows={cacheKeys}
                accent={C.amber}
              />
              <div style={{ marginTop: 16, padding: "14px 18px", background: `${C.red}10`, border: `1px solid ${C.red}30`, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.red, fontWeight: 700, letterSpacing: "0.1em", fontFamily: "JetBrains Mono, monospace", marginBottom: 6 }}>⚠ CRITICAL RULE</div>
                <div style={{ fontSize: 11, color: "#FCA5A5", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.7 }}>
                  Redis is NOT the source of truth. Any Redis key can be flushed and rebuilt from PostgreSQL. Never store data that exists only in Redis.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PipelinePage() {
  const steps = [
    { num: "01", title: "Scheduled Trigger", detail: "Trigger.dev Scheduled Job fires every hour per active connector", color: C.amber },
    { num: "02", title: "Azure SDK Call", detail: "AzureAdapterService calls Azure SDK with DefaultAzureCredential (Workload Identity)", color: C.blue },
    { num: "03", title: "Circuit Breaker", detail: "cockatiel monitors failure rate; opens circuit after 5 consecutive failures", color: C.red },
    { num: "04", title: "Service Bus Queue", detail: "Raw cost data published to Azure Service Bus topic: cost-ingestion-{tenantId}", color: C.cyan },
    { num: "05", title: "Data Normalisation", detail: "IngestionPipeline consumer reads from Service Bus and normalises records", color: C.purple },
    { num: "06", title: "TimescaleDB Write", detail: "Normalised records batch-inserted into cost_records hypertable", color: C.green },
    { num: "07", title: "Anomaly Detection", detail: "AnomalyDetectionService evaluates latest data window post-ingestion", color: C.amber },
    { num: "08", title: "Cache Invalidation", detail: "Redis cache keys for affected tenant are invalidated", color: C.red },
    { num: "09", title: "Alert Dispatch", detail: "If anomaly detected: record inserted + Resend email notification dispatched", color: C.purple },
  ];

  const sdkModules = [
    ["@azure/arm-costmanagement", "QueryUsage", "Daily cost by service, subscription, tag, resource group"],
    ["@azure/arm-resourcegraph", "Resources.list", "Resource inventory, metadata, location, compliance state"],
    ["@azure/arm-advisor", "Recommendations.list", "Cost optimisation, security, performance recommendations"],
    ["@azure/arm-monitor", "Metrics.list", "Resource utilisation metrics for anomaly context"],
    ["@azure/identity", "DefaultAzureCredential", "Workload Identity authentication — no static secrets"],
  ];

  return (
    <div>
      <SectionHeader title="Azure Ingestion Pipeline" sub="LLD · ASYNC ARCHITECTURE · CIRCUIT BREAKER · SDK MODULES" accent={C.amber} />

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: C.amber, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
          INGESTION FLOW — 9 STEPS
        </div>
        <div style={{ position: "relative" }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 16, marginBottom: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: s.color + "20", border: `2px solid ${s.color}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: s.color, fontFamily: "JetBrains Mono, monospace",
                  flexShrink: 0,
                }}>{s.num}</div>
                {i < steps.length - 1 && <div style={{ width: 2, height: 16, background: s.color + "40" }} />}
              </div>
              <div style={{
                flex: 1, background: C.card, border: `1px solid ${s.color}25`,
                borderRadius: 8, padding: "10px 16px", marginTop: 2,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: s.color, fontFamily: "Syne, sans-serif", marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.5 }}>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: C.red, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
          CIRCUIT BREAKER CONFIGURATION (cockatiel)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { k: "Failure Threshold", v: "5 consecutive failures → circuit OPEN" },
            { k: "Recovery Probe", v: "30 seconds interval" },
            { k: "Half-Open State", v: "1 test request; success → CLOSED" },
            { k: "Max Retries", v: "3 with jittered exponential backoff (base 1s, max 30s)" },
            { k: "Rate Limit", v: "Per-tenant 1 req/s throttle for Azure Cost Management API" },
            { k: "Library", v: "cockatiel (ConsecutiveBreaker + ExponentialBackoff)" },
          ].map((item, i) => (
            <InfoCard key={i} title={item.k} value={item.v} accent={C.red} />
          ))}
        </div>
      </div>

      <div style={{ fontSize: 10, color: C.blue, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
        AZURE SDK MODULES
      </div>
      <Table headers={["Package", "API Method", "Data Retrieved"]} rows={sdkModules} accent={C.blue} />
    </div>
  );
}

function SecurityPage() {
  const rbac = [
    { role: "ADMIN", perms: "Full CRUD on all resources, manage connectors, billing, users", users: "Cloud Platform Lead, CTO", color: C.red },
    { role: "ANALYST", perms: "Read all, create/update budgets and alerts, export reports", users: "FinOps Analyst, Cloud Engineer", color: C.amber },
    { role: "VIEWER", perms: "Read-only access to dashboards, anomalies, compliance", users: "CIO, Security Officer, Auditor", color: C.green },
  ];

  const securityLayers = [
    { area: "Identity & Access", detail: "Clerk with Microsoft Entra ID SSO; JWT claims carry orgId mapped to internal tenantId", color: C.cyan },
    { area: "Secrets Management", detail: "Azure Key Vault + DefaultAzureCredential with Workload Identity — no static secrets in env vars", color: C.green },
    { area: "Network Security", detail: "Azure Front Door WAF blocks OWASP Top-10, rate limiting, geo-blocking", color: C.red },
    { area: "API Security", detail: "NestJS Guards (Auth, Tenant, Roles) + Helmet + CORS + rate limiter on every route", color: C.amber },
    { area: "Data Encryption", detail: "AES-256 at rest (Azure managed), TLS 1.3 in transit", color: C.blue },
    { area: "Compliance", detail: "Audit log on every tenant action; PII scanning for storage residency checks", color: C.purple },
  ];

  return (
    <div>
      <SectionHeader title="Security Architecture" sub="HLD · AUTH · RBAC · NETWORK · ENCRYPTION" accent={C.red} />

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: C.red, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
          SECURITY LAYERS — DEFENCE IN DEPTH
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {securityLayers.map((s, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "180px 1fr",
              background: C.card, border: `1px solid ${s.color}25`,
              borderLeft: `4px solid ${s.color}`, borderRadius: 8, padding: "14px 18px", gap: 16,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.color, fontFamily: "Syne, sans-serif" }}>{s.area}</div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.6 }}>{s.detail}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: C.amber, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
          RBAC MODEL — THREE ROLES
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rbac.map((r, i) => (
            <div key={i} style={{
              background: C.card, border: `1px solid ${r.color}30`,
              borderRadius: 10, padding: "16px 20px",
              display: "grid", gridTemplateColumns: "100px 1fr 200px", gap: 16, alignItems: "center",
            }}>
              <div style={{
                fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif", color: r.color,
                padding: "6px 12px", background: r.color + "15", borderRadius: 6, textAlign: "center",
              }}>{r.role}</div>
              <div style={{ fontSize: 11, color: C.text, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.6 }}>{r.perms}</div>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.5 }}>
                <span style={{ color: r.color }}>Typical: </span>{r.users}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 10, color: C.purple, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
        CLERK WEBHOOK INTEGRATION
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { k: "Frontend", v: "ClerkProvider wraps Next.js; middleware protects all routes except /login and /signup" },
          { k: "Microsoft SSO", v: "Configured as Clerk OAuth provider; enterprise Entra ID SSO from day one" },
          { k: "Webhooks", v: "user.created, organization.created, membership.updated → synced to PostgreSQL" },
          { k: "Backend JWT", v: "@clerk/backend verifyToken() validates JWT on every NestJS request" },
          { k: "Org → Tenant", v: "TenantService resolves clerk_org_id → internal tenantId, cached in Redis for 30min" },
        ].map((item, i) => (
          <InfoCard key={i} title={item.k} value={item.v} accent={C.purple} wide={i === 4} />
        ))}
      </div>
    </div>
  );
}

function AIPage() {
  const components = [
    ["LLM", "Azure OpenAI gpt-4o", "Natural language understanding and answer generation"],
    ["Embedding Model", "Azure OpenAI text-embedding-3-small", "Convert findings and cost data into vector embeddings"],
    ["Vector Store", "pgvector on existing PostgreSQL", "Store and retrieve embeddings for RAG context retrieval"],
    ["Index Type", "HNSW (pgvector)", "Approximate nearest-neighbour search for low-latency retrieval"],
    ["RAG Orchestration", "NestJS CopilotModule", "Query processing, embedding, retrieval, prompt assembly, streaming"],
    ["Streaming", "Server-Sent Events (SSE)", "Stream Copilot tokens to frontend for real-time UX"],
  ];

  const embeddingStrategy = [
    { source: "Cost Records", strategy: "Embed daily summaries (service + amount + anomaly flag)", refresh: "Hourly post-ingestion", color: C.green },
    { source: "Anomalies", strategy: "Embed description + root-cause + affected service", refresh: "On detection", color: C.amber },
    { source: "Compliance Findings", strategy: "Embed PII scan summaries + policy violations", refresh: "On scan completion", color: C.red },
    { source: "Advisor Recommendations", strategy: "Embed recommendation text + impact", refresh: "Daily", color: C.blue },
  ];

  const ragSteps = [
    { step: "01", action: "User sends query in Copilot chat UI", color: C.cyan },
    { step: "02", action: "Query embedded via text-embedding-3-small → 1536-dim vector", color: C.blue },
    { step: "03", action: "pgvector HNSW search: top-10 chunks from copilot_embeddings WHERE tenant_id = $tenantId", color: C.purple },
    { step: "04", action: "Retrieved chunks ranked by cosine similarity — top-5 selected as context", color: C.purple },
    { step: "05", action: "System prompt assembled: tenant context + retrieved chunks + user query", color: C.amber },
    { step: "06", action: "gpt-4o completion streamed via Azure OpenAI API", color: C.green },
    { step: "07", action: "Response tokens streamed to frontend via Server-Sent Events (SSE)", color: C.cyan },
    { step: "08", action: "Full response stored in conversation history for follow-up context", color: C.muted },
  ];

  return (
    <div>
      <SectionHeader title="AI Copilot & RAG Architecture" sub="LLD · AZURE OPENAI · PGVECTOR · RAG PIPELINE" accent={C.purple} />

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: C.purple, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
          COPILOT STACK COMPONENTS
        </div>
        <Table headers={["Component", "Technology", "Role"]} rows={components} accent={C.purple} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: C.cyan, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
          RAG PIPELINE — 8 STEPS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ragSteps.map((s, i) => (
            <div key={i} style={{
              display: "flex", gap: 14, padding: "10px 16px",
              background: i % 2 === 0 ? C.card : C.surface, borderRadius: 7,
              border: `1px solid ${C.border}`, alignItems: "center",
            }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: s.color + "80", fontFamily: "JetBrains Mono, monospace", minWidth: 28 }}>{s.step}</span>
              <span style={{ fontSize: 11, color: C.text, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.5 }}>{s.action}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10, color: C.amber, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
          EMBEDDING STRATEGY — WHAT GETS EMBEDDED
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {embeddingStrategy.map((e, i) => (
            <div key={i} style={{
              background: C.card, border: `1px solid ${e.color}30`,
              borderTop: `3px solid ${e.color}`, borderRadius: 8, padding: "14px 16px",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: e.color, fontFamily: "Syne, sans-serif", marginBottom: 6 }}>{e.source}</div>
              <div style={{ fontSize: 11, color: C.text, fontFamily: "JetBrains Mono, monospace", marginBottom: 6, lineHeight: 1.5 }}>{e.strategy}</div>
              <Tag color={e.color}>Refresh: {e.refresh}</Tag>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <InfoCard title="CHUNK SIZE" value="512 tokens with 64-token overlap for context continuity" accent={C.purple} />
          <InfoCard title="VECTOR DIMENSIONS" value="1536 — output of text-embedding-3-small model" accent={C.purple} />
          <InfoCard title="INDEX TYPE" value="HNSW (Hierarchical Navigable Small World) — low-latency ANN search" accent={C.cyan} />
          <InfoCard title="TENANT ISOLATION" value="pgvector queries include WHERE tenant_id = $tenantId — RLS backed" accent={C.green} />
        </div>
      </div>
    </div>
  );
}

function CICDPage() {
  const pipeline = [
    { stage: "Code Quality", tool: "GitHub Actions", actions: "ESLint, TypeScript strict check, Prettier, import rules", color: C.cyan },
    { stage: "Testing", tool: "GitHub Actions + Jest", actions: "Unit tests (services), integration (Prisma + testcontainers), e2e (Playwright)", color: C.blue },
    { stage: "Security Scan", tool: "Snyk + Checkov", actions: "Dependency vulnerability scan, IaC security policy check on Terraform", color: C.red },
    { stage: "Build", tool: "GitHub Actions + Docker", actions: "Build NestJS Docker image, push to Azure Container Registry", color: C.amber },
    { stage: "IaC Plan", tool: "Terraform + GitHub Actions", actions: "Terraform plan on PR; human approval required for infra changes", color: C.purple },
    { stage: "Deploy (Staging)", tool: "GitHub Actions + Terraform", actions: "Auto-deploy to staging on merge to main; Terraform apply for infra changes", color: C.green },
    { stage: "Deploy (Prod)", tool: "GitHub Actions + Terraform", actions: "Manual approval gate; blue/green deployment via Container Apps revisions", color: C.green },
    { stage: "DB Migration", tool: "Prisma migrate + GitHub Actions", actions: "prisma migrate deploy runs in pipeline before API container starts", color: C.muted },
  ];

  const terraformResources = [
    "Azure Container Apps environment + NestJS app",
    "Azure Database for PostgreSQL Flexible Server (TimescaleDB extension enabled)",
    "Azure Cache for Redis (Standard tier)",
    "Azure Service Bus namespace + topics + subscriptions",
    "Azure Key Vault + access policies for Container Apps Workload Identity",
    "Azure Front Door + WAF policy",
    "Azure Monitor workspace + Grafana dashboard provisioning",
    "Azure Container Registry",
  ];

  const observability = [
    { pillar: "Logs", tool: "Pino → Azure Monitor", scope: "Backend + Jobs", signals: "Request logs, error context, ingestion events, audit trail", color: C.cyan },
    { pillar: "Metrics", tool: "OpenTelemetry → Grafana", scope: "All services", signals: "Request rate, latency p95/p99, ingestion lag, DB pool, circuit breaker state", color: C.green },
    { pillar: "Traces", tool: "OpenTelemetry → Azure Monitor", scope: "All services", signals: "End-to-end request spans, DB query spans, Azure SDK call spans", color: C.purple },
    { pillar: "Errors", tool: "Sentry", scope: "Frontend + Backend", signals: "Unhandled exceptions, performance issues, user session context", color: C.red },
  ];

  return (
    <div>
      <SectionHeader title="CI/CD & Infrastructure" sub="LLD · GITHUB ACTIONS · TERRAFORM · OBSERVABILITY" accent={C.amber} />

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: C.amber, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
          PIPELINE STAGES
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {pipeline.map((p, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "140px 200px 1fr",
              background: i % 2 === 0 ? C.card : C.surface,
              border: `1px solid ${p.color}20`, borderLeft: `3px solid ${p.color}`,
              borderRadius: 7, padding: "12px 16px", gap: 14,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: p.color, fontFamily: "Syne, sans-serif" }}>{p.stage}</div>
              <Tag color={p.color}>{p.tool}</Tag>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.5 }}>{p.actions}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 10, color: C.purple, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
            TERRAFORM-MANAGED RESOURCES
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {terraformResources.map((r, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, padding: "8px 12px",
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 6,
              }}>
                <span style={{ color: C.purple, fontSize: 10, flexShrink: 0, fontFamily: "JetBrains Mono, monospace" }}>◆</span>
                <span style={{ fontSize: 11, color: C.muted, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.5 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, color: C.green, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
            OBSERVABILITY STACK
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {observability.map((o, i) => (
              <div key={i} style={{
                background: C.card, border: `1px solid ${o.color}25`,
                borderLeft: `3px solid ${o.color}`, borderRadius: 8, padding: "12px 14px",
              }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: o.color, fontFamily: "Syne, sans-serif" }}>{o.pillar}</span>
                  <Tag color={o.color}>{o.tool}</Tag>
                </div>
                <div style={{ fontSize: 10, color: C.muted, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.5 }}>{o.signals}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NFRPage() {
  const nfrs = [
    { attr: "Availability", req: "Platform stays available during Azure API outages", mechanism: "Async ingestion + circuit breaker + cached data", target: "99.5% SLA", color: C.green },
    { attr: "Scalability", req: "Handle 100 tenants, 1000 subscriptions at MVP", mechanism: "Container Apps auto-scale, TimescaleDB compression", target: "Linear scale", color: C.blue },
    { attr: "Performance", req: "Dashboard load < 2s; Copilot first token < 3s", mechanism: "Redis cache, continuous aggregates, HNSW index", target: "p95 targets", color: C.cyan },
    { attr: "Security", req: "Zero cross-tenant data leakage", mechanism: "RLS + TenantGuard + Workload Identity + WAF", target: "Zero tolerance", color: C.red },
    { attr: "Data Residency", req: "EU data stays in EU (West Europe)", mechanism: "All Azure resources in West Europe region", target: "GDPR compliant", color: C.amber },
    { attr: "Recoverability", req: "RPO ≤ 4 hours, RTO ≤ 1 hour", mechanism: "Geo-redundant PostgreSQL backups, runbook automation", target: "Tier 2 DR", color: C.purple },
    { attr: "Observability", req: "All requests traced end-to-end", mechanism: "OpenTelemetry auto-instrumentation on NestJS + Prisma", target: "100% trace coverage", color: C.muted },
    { attr: "Auditability", req: "All user actions logged and immutable", mechanism: "Append-only audit_logs table, no DELETE permission", target: "90-day retention", color: C.purple },
  ];

  const risks = [
    { risk: "Cross-tenant data leak via Prisma bug", likelihood: "Low", impact: "Critical", mitigation: "PostgreSQL RLS as safety net; tenant isolation tests in CI", status: "Open", color: C.red },
    { risk: "Azure API throttling breaks ingestion", likelihood: "High", impact: "Medium", mitigation: "Circuit breaker + Service Bus queue + exponential backoff", status: "Mitigated", color: C.amber },
    { risk: "Secrets leak via env vars", likelihood: "Medium", impact: "Critical", mitigation: "Azure Key Vault + Workload Identity (no static secrets)", status: "Open", color: C.red },
    { risk: "Copilot hallucination on cost data", likelihood: "Medium", impact: "Medium", mitigation: "RAG grounds responses in real data; UI shows source citations", status: "Open", color: C.amber },
    { risk: "Vercel/Azure split deployment CORS", likelihood: "Medium", impact: "High", mitigation: "CORS tested in CI; Azure Front Door as single entry point", status: "Open", color: C.amber },
    { risk: "TimescaleDB queries slow at 90-day volume", likelihood: "Medium", impact: "Medium", mitigation: "Continuous aggregates + compression + retention policy", status: "Mitigated", color: C.green },
    { risk: "Clerk org/tenant mapping drift", likelihood: "Low", impact: "High", mitigation: "Webhook-driven sync; reconciliation job runs nightly", status: "Open", color: C.amber },
  ];

  return (
    <div>
      <SectionHeader title="NFR & Risk Register" sub="QUALITY ATTRIBUTES · RISKS · MITIGATIONS" accent={C.purple} />

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: C.purple, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
          NON-FUNCTIONAL REQUIREMENTS
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {nfrs.map((n, i) => (
            <div key={i} style={{
              background: C.card, border: `1px solid ${n.color}25`,
              borderTop: `3px solid ${n.color}`, borderRadius: 8, padding: "14px 16px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: n.color, fontFamily: "Syne, sans-serif" }}>{n.attr}</div>
                <Tag color={n.color}>{n.target}</Tag>
              </div>
              <div style={{ fontSize: 11, color: C.text, fontFamily: "JetBrains Mono, monospace", marginBottom: 6, lineHeight: 1.5 }}>{n.req}</div>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.5 }}>{n.mechanism}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10, color: C.red, letterSpacing: "0.15em", fontFamily: "JetBrains Mono, monospace", marginBottom: 14, fontWeight: 700 }}>
          ARCHITECTURE RISK REGISTER
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {risks.map((r, i) => (
            <div key={i} style={{
              background: C.card, border: `1px solid ${r.color}25`,
              borderLeft: `4px solid ${r.color}`, borderRadius: 8, padding: "12px 16px",
              display: "grid", gridTemplateColumns: "1fr 70px 70px 200px 80px", gap: 12, alignItems: "center",
            }}>
              <div style={{ fontSize: 11, color: C.text, fontFamily: "JetBrains Mono, monospace" }}>{r.risk}</div>
              <Tag color={r.color}>{r.likelihood}</Tag>
              <Tag color={r.impact === "Critical" ? C.red : r.impact === "High" ? C.amber : C.muted}>{r.impact}</Tag>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.5 }}>{r.mitigation}</div>
              <Tag color={r.status === "Mitigated" ? C.green : C.red}>{r.status}</Tag>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ADRPage() {
  const adrs = [
    {
      id: "ADR-01", decision: "Modular Monolith over Microservices",
      rationale: "Single team, MVP speed, clear module boundaries for future extraction",
      rejected: "Microservices (too complex for MVP); Serverless (cold starts for long-running ingestion)",
      color: C.cyan,
    },
    {
      id: "ADR-02", decision: "TimescaleDB over ClickHouse",
      rationale: "Reuses existing PostgreSQL infra, Prisma compatible, supports standard SQL",
      rejected: "ClickHouse (operational overhead, separate system); BigQuery (vendor lock-in, latency)",
      color: C.green,
    },
    {
      id: "ADR-03", decision: "pgvector over Pinecone for RAG",
      rationale: "No additional service, tenant RLS applies automatically, cost-effective at MVP scale",
      rejected: "Pinecone (extra cost, SaaS dependency, no RLS); Weaviate (operational complexity)",
      color: C.purple,
    },
    {
      id: "ADR-04", decision: "Azure Service Bus over direct DB writes",
      rationale: "Decouples ingestion from processing, handles Azure API throttling, enables retry without data loss",
      rejected: "Direct PostgreSQL write (no buffering, throttling risk); Kafka (operational overhead for MVP)",
      color: C.amber,
    },
    {
      id: "ADR-05", decision: "Clerk for Auth over custom Auth",
      rationale: "Enterprise SSO (Entra ID) out-of-box, MFA, org management, reduces auth build time by 80%",
      rejected: "Auth0 (higher cost at scale); Custom JWT (significant build effort, security risk)",
      color: C.blue,
    },
    {
      id: "ADR-06", decision: "PostgreSQL RLS for tenant isolation",
      rationale: "Non-bypassable safety net independent of application code correctness",
      rejected: "Application-only isolation (single point of failure); Separate DB per tenant (operational complexity)",
      color: C.red,
    },
    {
      id: "ADR-07", decision: "DefaultAzureCredential + Workload Identity",
      rationale: "No static secrets, credentials rotate automatically, follows Azure security best practice",
      rejected: "ClientSecretCredential (static secret still required); Managed Identity only (limited to Azure-hosted)",
      color: C.green,
    },
  ];

  return (
    <div>
      <SectionHeader title="Architecture Decisions" sub="ADR LOG · RATIONALE · ALTERNATIVES REJECTED" accent={C.blue} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {adrs.map((a, i) => (
          <div key={i} style={{
            background: C.card, border: `1px solid ${a.color}25`,
            borderRadius: 10, padding: "18px 20px",
          }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
              <div style={{
                padding: "4px 12px", background: a.color + "20", border: `1px solid ${a.color}40`,
                borderRadius: 4, fontSize: 11, fontWeight: 800, color: a.color, fontFamily: "JetBrains Mono, monospace",
              }}>{a.id}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text, fontFamily: "Syne, sans-serif" }}>{a.decision}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ background: `${a.color}08`, border: `1px solid ${a.color}20`, borderRadius: 7, padding: "10px 14px" }}>
                <div style={{ fontSize: 9, color: a.color, letterSpacing: "0.12em", fontFamily: "JetBrains Mono, monospace", fontWeight: 700, marginBottom: 6 }}>RATIONALE</div>
                <div style={{ fontSize: 11, color: C.text, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.7 }}>{a.rationale}</div>
              </div>
              <div style={{ background: `${C.red}06`, border: `1px solid ${C.red}15`, borderRadius: 7, padding: "10px 14px" }}>
                <div style={{ fontSize: 9, color: C.red, letterSpacing: "0.12em", fontFamily: "JetBrains Mono, monospace", fontWeight: 700, marginBottom: 6 }}>ALTERNATIVES REJECTED</div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.7 }}>{a.rejected}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PAGES = {
  overview: OverviewPage,
  hld: HLDPage,
  stack: StackPage,
  data: DataPage,
  pipeline: PipelinePage,
  security: SecurityPage,
  ai: AIPage,
  cicd: CICDPage,
  nfr: NFRPage,
  adr: ADRPage,
};

/* ─── ROOT APP ───────────────────────────────────────────────────────────── */
export default function App() {
  const [active, setActive] = useState("overview");
  const Page = PAGES[active];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "JetBrains Mono, monospace" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />

      {/* TOP HEADER */}
      <div style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "0 24px", display: "flex", alignItems: "center", gap: 0, height: 52,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginRight: 32, flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32, background: C.cyan + "20", border: `1px solid ${C.cyan}50`,
            borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: C.cyan,
          }}>◈</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "Syne, sans-serif", letterSpacing: "0.04em" }}>CloudGuard 360</div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em" }}>ARCHITECTURE HLD/LLD</div>
          </div>
        </div>

        {/* HORIZONTAL NAV */}
        <div style={{ display: "flex", gap: 2, overflowX: "auto", flex: 1 }}>
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setActive(item.id)} style={{
              padding: "6px 14px", border: "none", cursor: "pointer",
              background: active === item.id ? C.cyan + "18" : "transparent",
              color: active === item.id ? C.cyan : C.muted,
              borderBottom: active === item.id ? `2px solid ${C.cyan}` : "2px solid transparent",
              fontFamily: "JetBrains Mono, monospace", fontSize: 11, fontWeight: 700,
              whiteSpace: "nowrap", transition: "all 0.14s", display: "flex", gap: 6, alignItems: "center",
              letterSpacing: "0.04em", height: 52,
            }}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div style={{
          marginLeft: 16, padding: "3px 10px", background: C.green + "20",
          border: `1px solid ${C.green}40`, borderRadius: 4,
          fontSize: 9, color: C.green, fontFamily: "JetBrains Mono, monospace", fontWeight: 700,
          letterSpacing: "0.08em", flexShrink: 0,
        }}>v1.0 · MARCH 2026</div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
        <Page />
      </div>
    </div>
  );
}
