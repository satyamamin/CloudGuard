import { useState } from "react";

const FONT = "'IBM Plex Mono', monospace";
const DISPLAY = "'Bebas Neue', sans-serif";

const P = {
  bg: "#070B14", surface: "#0C1220", surfaceHigh: "#111827",
  border: "#1E2D45", borderBright: "#2E4A6B",
  blue: "#0EA5E9", purple: "#8B5CF6", green: "#10B981",
  amber: "#F59E0B", red: "#EF4444", cyan: "#06B6D4",
  text: "#E2E8F0", muted: "#64748B", dim: "#1E2D45",
};

const stores = [
  {
    id: "postgres",
    name: "PostgreSQL + TimescaleDB",
    badge: "PRIMARY STORE",
    host: "Azure Database for PostgreSQL Flexible Server",
    local: "Docker (timescale/timescaledb:latest-pg16)",
    color: "#0EA5E9",
    icon: "🐘",
    role: "Single source of truth — all persistent business data lives here",
    tables: [
      {
        name: "tenants",
        type: "OLTP",
        typeColor: "#0EA5E9",
        phase: "P1",
        rls: true,
        rows: [
          { col: "id", type: "UUID PK", note: "Internal tenant identifier" },
          { col: "clerk_org_id", type: "STRING UNIQUE", note: "Maps Clerk org → internal tenant" },
          { col: "name", type: "STRING", note: "Enterprise customer name" },
          { col: "plan", type: "STRING", note: "Subscription plan tier" },
          { col: "created_at", type: "TIMESTAMP", note: "Tenant creation date" },
        ],
        purpose: "Root of multi-tenancy. Every other table references this.",
        size: "Tiny — 1 row per enterprise customer",
      },
      {
        name: "connectors",
        type: "OLTP",
        typeColor: "#0EA5E9",
        phase: "P2",
        rls: true,
        rows: [
          { col: "id", type: "UUID PK", note: "Connector identifier" },
          { col: "tenant_id", type: "UUID FK → tenants", note: "RLS policy column" },
          { col: "subscription_id", type: "STRING", note: "Azure Subscription ID" },
          { col: "display_name", type: "STRING", note: "Human label for the subscription" },
          { col: "status", type: "ENUM", note: "active | failed | paused" },
          { col: "last_synced_at", type: "TIMESTAMP", note: "Last successful ingestion time" },
          { col: "created_at", type: "TIMESTAMP", note: "When connector was added" },
        ],
        purpose: "One row per Azure subscription connected by a tenant.",
        size: "Small — typically 1–10 per tenant",
      },
      {
        name: "cost_records",
        type: "TIMESCALEDB HYPERTABLE",
        typeColor: "#10B981",
        phase: "P3",
        rls: true,
        rows: [
          { col: "time", type: "TIMESTAMPTZ (partition key)", note: "Partitioned by day — TimescaleDB" },
          { col: "tenant_id", type: "UUID FK → tenants", note: "RLS policy column" },
          { col: "connector_id", type: "UUID FK → connectors", note: "Which Azure subscription" },
          { col: "service_name", type: "STRING", note: "e.g. Virtual Machines, Storage" },
          { col: "amount", type: "FLOAT", note: "Cost in currency units" },
          { col: "currency", type: "STRING", note: "USD, EUR etc." },
          { col: "subscription_id", type: "STRING", note: "Azure Subscription ID (denormalised)" },
          { col: "resource_group", type: "STRING", note: "Azure resource group" },
          { col: "tags", type: "JSONB", note: "Azure resource tags for filtering" },
        ],
        purpose: "Core FinOps data — every Azure cost record ingested lives here. This is the biggest table.",
        size: "Large — grows daily. 1 row per service per day per connector. 100 services × 30 days × 10 tenants = 30,000 rows/month",
        timescale: {
          chunkInterval: "1 day",
          compression: "After 7 days",
          retention: "Raw: 90 days | Aggregates: 2 years",
          aggregates: ["daily_cost_by_service", "monthly_cost_by_subscription"],
        },
      },
      {
        name: "users",
        type: "OLTP",
        typeColor: "#0EA5E9",
        phase: "P2",
        rls: true,
        rows: [
          { col: "id", type: "UUID PK", note: "Internal user identifier" },
          { col: "tenant_id", type: "UUID FK → tenants", note: "RLS policy column" },
          { col: "clerk_user_id", type: "STRING UNIQUE", note: "Maps Clerk user → internal user" },
          { col: "email", type: "STRING", note: "Synced from Clerk webhook" },
          { col: "role", type: "ENUM", note: "ADMIN | ANALYST | VIEWER" },
          { col: "created_at", type: "TIMESTAMP", note: "" },
        ],
        purpose: "Mirrors Clerk users locally for RBAC and audit trail purposes.",
        size: "Small — 1 row per user per tenant",
      },
      {
        name: "audit_logs",
        type: "OLTP (APPEND-ONLY)",
        typeColor: "#8B5CF6",
        phase: "P2",
        rls: true,
        rows: [
          { col: "id", type: "UUID PK", note: "" },
          { col: "tenant_id", type: "UUID FK → tenants", note: "RLS policy column" },
          { col: "user_id", type: "UUID FK → users", note: "Who performed the action" },
          { col: "action", type: "STRING", note: "e.g. CONNECTOR_ADDED, SYNC_TRIGGERED" },
          { col: "resource_type", type: "STRING", note: "e.g. connector, budget" },
          { col: "resource_id", type: "STRING", note: "ID of the affected resource" },
          { col: "timestamp", type: "TIMESTAMPTZ", note: "Immutable — no UPDATE allowed" },
          { col: "metadata", type: "JSONB", note: "Additional context for the action" },
        ],
        purpose: "Immutable audit trail. No UPDATE or DELETE permissions on this table. Required for compliance export.",
        size: "Medium — grows with user activity",
      },
      {
        name: "budgets",
        type: "OLTP",
        typeColor: "#0EA5E9",
        phase: "POST-MVP",
        rls: true,
        rows: [
          { col: "id", type: "UUID PK", note: "" },
          { col: "tenant_id", type: "UUID FK → tenants", note: "RLS policy column" },
          { col: "connector_id", type: "UUID FK → connectors", note: "Scoped to subscription" },
          { col: "amount", type: "FLOAT", note: "Budget ceiling" },
          { col: "period", type: "ENUM", note: "monthly | quarterly | annual" },
          { col: "alert_threshold", type: "FLOAT", note: "% at which to send alert (e.g. 0.8)" },
        ],
        purpose: "Budget definitions per tenant/subscription. Alert logic compares cost_records sum against this.",
        size: "Tiny — few rows per tenant",
      },
    ],
  },
  {
    id: "redis",
    name: "Redis",
    badge: "CACHE LAYER",
    host: "Azure Cache for Redis (Standard)",
    local: "Docker (redis:7-alpine) port 6379",
    color: "#EF4444",
    icon: "⚡",
    role: "Performance layer — prevents repeated expensive DB queries on every dashboard load",
    keys: [
      {
        pattern: "cost:summary:{tenantId}",
        ttl: "60 min",
        data: "MTD total spend, top 5 services, % change vs last month",
        invalidate: "On new ingestion batch completing",
        size: "~2 KB per tenant",
        phase: "P3",
      },
      {
        pattern: "cost:daily:{tenantId}:{month}",
        ttl: "60 min",
        data: "Array of {date, amount} for 30-day trend chart",
        invalidate: "On new ingestion batch completing",
        size: "~3 KB per tenant per month",
        phase: "P3",
      },
      {
        pattern: "cost:services:{tenantId}",
        ttl: "60 min",
        data: "Service breakdown array for bar chart",
        invalidate: "On new ingestion batch completing",
        size: "~4 KB per tenant",
        phase: "P3",
      },
      {
        pattern: "tenant:{tenantId}:config",
        ttl: "30 min",
        data: "Tenant settings, connector list, plan details",
        invalidate: "On any tenant config change",
        size: "~1 KB per tenant",
        phase: "P2",
      },
      {
        pattern: "session:{userId}",
        ttl: "24 hr",
        data: "User session data, resolved tenantId, role",
        invalidate: "On logout or role change",
        size: "~0.5 KB per user",
        phase: "P2",
      },
      {
        pattern: "connector:status:{connectorId}",
        ttl: "5 min",
        data: "Last sync time, sync status, error if any",
        invalidate: "On each sync attempt",
        size: "~0.2 KB per connector",
        phase: "P3",
      },
    ],
    important: [
      "Redis is NOT the source of truth — only a cache",
      "Any Redis key can be deleted — the system rebuilds from PostgreSQL",
      "Never store data in Redis that only exists in Redis",
      "TTLs are defined per key pattern — never indefinite",
    ],
  },
  {
    id: "clerk",
    name: "Clerk",
    badge: "IDENTITY STORE",
    host: "Clerk SaaS (managed)",
    local: "Clerk SaaS (same — no local equivalent)",
    color: "#8B5CF6",
    icon: "🔐",
    role: "Owns all identity data — users, organisations, sessions, SSO connections",
    stores: [
      { item: "User accounts", detail: "Email, password hash, name, avatar — managed entirely by Clerk" },
      { item: "Organisation (Tenant) membership", detail: "Which users belong to which org — Clerk manages this" },
      { item: "SSO connections", detail: "Microsoft Entra ID OAuth tokens — Clerk handles refresh" },
      { item: "JWT sessions", detail: "Short-lived JWTs with userId, orgId, role claims — verified in NestJS" },
      { item: "Webhooks", detail: "user.created, org.created, membership.updated → synced to your PostgreSQL users table" },
    ],
    important: [
      "You never store passwords — Clerk owns them",
      "You only store clerk_user_id and clerk_org_id as foreign keys in your DB",
      "Clerk JWTs expire — NestJS verifies on every request",
      "User profile changes in Clerk sync to your DB via webhooks",
    ],
  },
  {
    id: "azureblob",
    name: "Azure Blob Storage",
    badge: "FILE STORE",
    host: "Azure Storage Account",
    local: "Azurite (Azure Storage emulator) — optional for MVP",
    color: "#06B6D4",
    icon: "📦",
    role: "Stores generated files — audit report PDFs and any exported data",
    stores: [
      { item: "Audit report PDFs", detail: "Generated on demand, stored with signed URL for download. Never served directly." },
      { item: "Cost export CSVs", detail: "Bulk exports of cost_records for tenant download" },
      { item: "Container: audit-reports/{tenantId}/", detail: "Per-tenant container prefix for isolation" },
      { item: "Access pattern", detail: "NestJS generates PDF → uploads to Blob → returns 1-hour signed URL to frontend" },
    ],
    important: [
      "NOT used for application data — only for generated file downloads",
      "Signed URLs expire — no permanent public access",
      "MVP can skip this — export feature is post-prototype",
      "Per-tenant prefix enforces logical isolation at storage level",
    ],
  },
  {
    id: "triggerdev",
    name: "Trigger.dev",
    badge: "JOB STATE",
    host: "Trigger.dev Cloud (managed SaaS)",
    local: "Trigger.dev CLI + local dev server",
    color: "#F59E0B",
    icon: "⚙",
    role: "Stores job execution state — run history, retry attempts, payloads, logs",
    stores: [
      { item: "Job run history", detail: "Every ingestAzureCosts execution — status, duration, rows ingested" },
      { item: "Retry state", detail: "Failed attempts, backoff timers, error messages" },
      { item: "Job payloads", detail: "Input payload per run: connectorId, subscriptionId, tenantId" },
      { item: "Execution logs", detail: "Per-step logs for debugging failed ingestion runs" },
    ],
    important: [
      "Trigger.dev is NOT your database — job outputs write to PostgreSQL",
      "Job state is for operational visibility only",
      "You query Trigger.dev dashboard for debugging — not from your app",
      "Ingested data lands in cost_records (PostgreSQL) — not in Trigger.dev",
    ],
  },
];

const rlsExplainer = [
  { table: "tenants", policy: "No RLS needed — root table, no tenant_id FK", color: "#64748B" },
  { table: "connectors", policy: "tenant_id = current_setting('app.tenant_id')::uuid", color: "#0EA5E9" },
  { table: "cost_records", policy: "tenant_id = current_setting('app.tenant_id')::uuid", color: "#10B981" },
  { table: "users", policy: "tenant_id = current_setting('app.tenant_id')::uuid", color: "#8B5CF6" },
  { table: "audit_logs", policy: "tenant_id = current_setting('app.tenant_id')::uuid + NO DELETE", color: "#F59E0B" },
  { table: "budgets", policy: "tenant_id = current_setting('app.tenant_id')::uuid", color: "#06B6D4" },
];

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function StoreTab({ store, isActive, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", textAlign: "left", cursor: "pointer",
      background: isActive ? store.color + "18" : "transparent",
      border: `1px solid ${isActive ? store.color : P.border}`,
      borderLeft: `4px solid ${store.color}`,
      borderRadius: 7, padding: "10px 12px", marginBottom: 5,
      transition: "all 0.15s",
    }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>{store.icon}</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? P.text : "#94A3B8", fontFamily: FONT }}>{store.name}</div>
          <div style={{
            fontSize: 8, fontWeight: 800, color: store.color,
            letterSpacing: "0.1em", fontFamily: FONT,
          }}>{store.badge}</div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: P.muted, fontFamily: FONT, lineHeight: 1.4 }}>
        {store.role.substring(0, 60)}...
      </div>
    </button>
  );
}

function TableDetail({ table, storeColor }) {
  const [open, setOpen] = useState(false);
  const phaseColor = table.phase === "POST-MVP" ? "#64748B" :
    table.phase === "P1" ? "#0EA5E9" :
    table.phase === "P2" ? "#8B5CF6" :
    table.phase === "P3" ? "#10B981" : "#F59E0B";

  return (
    <div style={{
      border: `1px solid ${open ? storeColor + "40" : P.border}`,
      borderRadius: 8, marginBottom: 8, overflow: "hidden",
      transition: "all 0.15s",
    }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", textAlign: "left", cursor: "pointer",
        background: open ? storeColor + "10" : P.surfaceHigh,
        padding: "10px 14px", border: "none",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 13, fontFamily: "'Courier New', monospace", color: storeColor, fontWeight: 700 }}>
            {table.name}
          </span>
          <span style={{
            fontSize: 8, padding: "2px 6px", borderRadius: 3, fontFamily: FONT,
            background: table.typeColor + "20", color: table.typeColor, fontWeight: 700,
          }}>{table.type}</span>
          {table.rls && (
            <span style={{
              fontSize: 8, padding: "2px 6px", borderRadius: 3, fontFamily: FONT,
              background: "#8B5CF620", color: "#8B5CF6", fontWeight: 700,
            }}>RLS ✓</span>
          )}
          <span style={{
            fontSize: 8, padding: "2px 6px", borderRadius: 3, fontFamily: FONT,
            background: phaseColor + "20", color: phaseColor,
          }}>{table.phase}</span>
        </div>
        <span style={{ color: P.muted, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "14px 16px", background: P.surface }}>
          <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 12, fontFamily: FONT, lineHeight: 1.5 }}>
            {table.purpose}
          </div>
          <div style={{ fontSize: 10, color: table.typeColor, marginBottom: 10, fontFamily: FONT, fontWeight: 700 }}>
            {table.size}
          </div>

          {/* Columns */}
          <div style={{ marginBottom: table.timescale ? 12 : 0 }}>
            <div style={{ fontSize: 8, color: P.muted, letterSpacing: "0.12em", marginBottom: 6 }}>COLUMNS</div>
            {table.rows.map((row, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "160px 200px 1fr",
                gap: 8, padding: "6px 8px", marginBottom: 2,
                background: i % 2 === 0 ? "#070B14" : "transparent",
                borderRadius: 4,
              }}>
                <span style={{ fontSize: 10, color: storeColor, fontFamily: "'Courier New', monospace" }}>{row.col}</span>
                <span style={{ fontSize: 9, color: "#F59E0B", fontFamily: FONT }}>{row.type}</span>
                <span style={{ fontSize: 9, color: P.muted, fontFamily: FONT }}>{row.note}</span>
              </div>
            ))}
          </div>

          {/* TimescaleDB config */}
          {table.timescale && (
            <div style={{
              marginTop: 12, padding: "12px 14px",
              background: "#0A1A0F", border: "1px solid #10B98130", borderRadius: 8,
            }}>
              <div style={{ fontSize: 9, color: "#10B981", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 800 }}>
                TIMESCALEDB CONFIG
              </div>
              {[
                ["Chunk Interval", table.timescale.chunkInterval],
                ["Compression", table.timescale.compression],
                ["Retention", table.timescale.retention],
                ["Continuous Aggregates", table.timescale.aggregates.join(", ")],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 12, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: P.muted, fontFamily: FONT, minWidth: 140 }}>{k}:</span>
                  <span style={{ fontSize: 9, color: "#6EE7B7", fontFamily: FONT }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RedisView({ store }) {
  return (
    <div>
      <div style={{ marginBottom: 16, padding: "12px 16px", background: "#1A0A0A", border: "1px solid #EF444430", borderRadius: 8 }}>
        <div style={{ fontSize: 9, color: "#EF4444", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 800 }}>
          ⚠ CRITICAL RULE
        </div>
        {store.important.map((n, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <span style={{ color: "#EF4444", fontSize: 10, flexShrink: 0, fontFamily: FONT }}>▸</span>
            <span style={{ fontSize: 10, color: "#FCA5A5", fontFamily: FONT, lineHeight: 1.5 }}>{n}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 9, color: P.muted, letterSpacing: "0.12em", marginBottom: 10 }}>CACHE KEYS</div>
      {store.keys.map((k, i) => (
        <div key={i} style={{
          border: "1px solid #1E2D45", borderRadius: 8, padding: "12px 14px", marginBottom: 8,
          background: P.surfaceHigh,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <code style={{ fontSize: 11, color: "#EF4444", fontFamily: "'Courier New', monospace" }}>{k.pattern}</code>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 3, background: "#F59E0B20", color: "#F59E0B", fontFamily: FONT }}>
                TTL: {k.ttl}
              </span>
              <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 3, background: "#0EA5E920", color: "#0EA5E9", fontFamily: FONT }}>
                {k.phase}
              </span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: FONT, marginBottom: 4, lineHeight: 1.5 }}>{k.data}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, color: P.muted, fontFamily: FONT }}>Invalidate: {k.invalidate}</span>
            <span style={{ fontSize: 9, color: P.muted, fontFamily: FONT }}>· {k.size}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SimpleStoreView({ store }) {
  return (
    <div>
      <div style={{ marginBottom: 14, padding: "12px 16px", background: store.color + "10", border: `1px solid ${store.color}30`, borderRadius: 8 }}>
        <div style={{ fontSize: 9, color: store.color, letterSpacing: "0.1em", marginBottom: 8, fontWeight: 800 }}>
          WHAT IS STORED HERE
        </div>
        {store.stores.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
            <span style={{ color: store.color, fontSize: 10, flexShrink: 0, marginTop: 2 }}>◆</span>
            <div>
              <div style={{ fontSize: 11, color: P.text, fontFamily: FONT, fontWeight: 700 }}>{s.item}</div>
              <div style={{ fontSize: 10, color: P.muted, fontFamily: FONT, lineHeight: 1.5 }}>{s.detail}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: "12px 16px", background: "#1A1A0A", border: "1px solid #F59E0B30", borderRadius: 8 }}>
        <div style={{ fontSize: 9, color: "#F59E0B", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 800 }}>
          IMPORTANT
        </div>
        {store.important.map((n, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <span style={{ color: "#F59E0B", fontSize: 10, flexShrink: 0 }}>▸</span>
            <span style={{ fontSize: 10, color: "#FDE68A", fontFamily: FONT, lineHeight: 1.5 }}>{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RLSPanel() {
  return (
    <div style={{ background: P.surface, border: "1px solid #8B5CF640", borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 9, color: "#8B5CF6", letterSpacing: "0.14em", marginBottom: 12, fontWeight: 800 }}>
        ROW-LEVEL SECURITY — TENANT ISOLATION
      </div>
      <div style={{ fontSize: 10, color: P.muted, fontFamily: FONT, marginBottom: 12, lineHeight: 1.6 }}>
        Every table with tenant data has an RLS policy. Even if application code has a bug, the database engine itself prevents cross-tenant data access.
      </div>
      {rlsExplainer.map((r, i) => (
        <div key={i} style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          padding: "8px 10px", marginBottom: 4,
          background: "#070B14", border: `1px solid ${r.color}20`,
          borderLeft: `3px solid ${r.color}`, borderRadius: 5,
        }}>
          <code style={{ fontSize: 10, color: r.color, fontFamily: "'Courier New', monospace", minWidth: 100, flexShrink: 0 }}>
            {r.table}
          </code>
          <span style={{ fontSize: 9, color: P.muted, fontFamily: FONT, lineHeight: 1.5 }}>{r.policy}</span>
        </div>
      ))}
      <div style={{ marginTop: 12, padding: "10px 12px", background: "#0A0F1E", borderRadius: 6 }}>
        <code style={{ fontSize: 10, color: "#10B981", fontFamily: "'Courier New', monospace", display: "block", lineHeight: 1.8 }}>
          {"-- Set before every Prisma query:"}<br/>
          {"SET LOCAL app.tenant_id = '{tenantId}';"}
        </code>
      </div>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState("postgres");
  const activeStore = stores.find(s => s.id === active);

  return (
    <div style={{ background: P.bg, minHeight: "100vh", padding: 20, fontFamily: FONT }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Bebas+Neue&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 9, color: P.muted, letterSpacing: "0.18em", marginBottom: 4 }}>
          CLOUDGUARD 360 — DATA ARCHITECTURE
        </div>
        <h1 style={{
          margin: 0, fontFamily: DISPLAY, letterSpacing: "0.06em",
          fontSize: "clamp(24px, 4vw, 36px)", lineHeight: 1,
          background: "linear-gradient(90deg, #0EA5E9, #EF4444, #8B5CF6, #06B6D4)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>WHERE ALL DATA IS STORED</h1>
        <div style={{ fontSize: 10, color: P.muted, marginTop: 4 }}>
          5 storage systems · every table · every cache key · every file
        </div>
      </div>

      {/* Summary bar */}
      <div style={{
        display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap",
      }}>
        {[
          { label: "PostgreSQL", sub: "Persistent data", color: "#0EA5E9", detail: "6 tables · OLTP + TimescaleDB" },
          { label: "Redis", sub: "Cache layer", color: "#EF4444", detail: "6 key patterns · TTL-defined" },
          { label: "Clerk", sub: "Identity", color: "#8B5CF6", detail: "Users · Orgs · Sessions" },
          { label: "Azure Blob", sub: "Files", color: "#06B6D4", detail: "PDFs · CSV exports" },
          { label: "Trigger.dev", sub: "Job state", color: "#F59E0B", detail: "Run history · Retries" },
        ].map(s => (
          <div key={s.label} style={{
            background: s.color + "12", border: `1px solid ${s.color}30`,
            borderRadius: 8, padding: "10px 14px", flex: 1, minWidth: 130,
            cursor: "pointer",
          }} onClick={() => setActive(stores.find(st => st.name.includes(s.label))?.id || active)}>
            <div style={{ fontSize: 13, fontWeight: 700, color: s.color, fontFamily: DISPLAY, letterSpacing: "0.04em" }}>{s.label}</div>
            <div style={{ fontSize: 9, color: P.muted, fontFamily: FONT, marginTop: 2 }}>{s.sub}</div>
            <div style={{ fontSize: 9, color: s.color + "90", fontFamily: FONT, marginTop: 4 }}>{s.detail}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "230px 1fr 260px", gap: 16 }}>

        {/* LEFT */}
        <div>
          <div style={{ fontSize: 9, color: P.muted, letterSpacing: "0.14em", marginBottom: 10 }}>STORAGE SYSTEMS</div>
          {stores.map(s => <StoreTab key={s.id} store={s} isActive={active === s.id} onClick={() => setActive(s.id)} />)}
        </div>

        {/* CENTER */}
        <div style={{ background: P.surface, border: "1px solid #1E2D45", borderRadius: 12, padding: 22 }}>
          {/* Store header */}
          <div style={{ borderBottom: "1px solid #1E2D45", paddingBottom: 16, marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 24 }}>{activeStore.icon}</span>
                <div>
                  <div style={{ fontFamily: DISPLAY, fontSize: 22, color: P.text, letterSpacing: "0.04em" }}>
                    {activeStore.name.toUpperCase()}
                  </div>
                  <span style={{
                    fontSize: 8, padding: "2px 8px", borderRadius: 3,
                    background: activeStore.color + "25", color: activeStore.color,
                    fontWeight: 800, letterSpacing: "0.1em",
                  }}>{activeStore.badge}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              {[
                ["PRODUCTION", activeStore.host],
                ["LOCAL DEV", activeStore.local],
              ].map(([label, val]) => (
                <div key={label} style={{ background: "#070B14", borderRadius: 6, padding: "8px 10px" }}>
                  <div style={{ fontSize: 8, color: P.muted, letterSpacing: "0.1em", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 10, color: activeStore.color, fontFamily: FONT }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: "#94A3B8", fontFamily: FONT, lineHeight: 1.6 }}>
              {activeStore.role}
            </div>
          </div>

          {/* Content */}
          {activeStore.id === "postgres" && (
            <div>
              <div style={{ fontSize: 9, color: P.muted, letterSpacing: "0.12em", marginBottom: 10 }}>
                TABLES — CLICK TO EXPAND
              </div>
              {activeStore.tables.map(t => (
                <TableDetail key={t.name} table={t} storeColor={activeStore.color} />
              ))}
            </div>
          )}
          {activeStore.id === "redis" && <RedisView store={activeStore} />}
          {(activeStore.id === "clerk" || activeStore.id === "azureblob" || activeStore.id === "triggerdev") && (
            <SimpleStoreView store={activeStore} />
          )}
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <RLSPanel />

          {/* Data flow */}
          <div style={{ background: P.surface, border: "1px solid #1E2D45", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 9, color: P.muted, letterSpacing: "0.14em", marginBottom: 12 }}>
              WHERE EACH DATA TYPE LIVES
            </div>
            {[
              { label: "User identity", store: "Clerk", color: "#8B5CF6" },
              { label: "Tenant config", store: "PostgreSQL + Redis", color: "#0EA5E9" },
              { label: "Azure credentials", store: "Azure Key Vault", color: "#06B6D4" },
              { label: "Cost records (raw)", store: "TimescaleDB", color: "#10B981" },
              { label: "Dashboard queries", store: "Redis (cache)", color: "#EF4444" },
              { label: "Job run history", store: "Trigger.dev", color: "#F59E0B" },
              { label: "Audit trail", store: "PostgreSQL (append-only)", color: "#8B5CF6" },
              { label: "Report PDFs", store: "Azure Blob Storage", color: "#06B6D4" },
              { label: "Sessions", store: "Clerk + Redis", color: "#8B5CF6" },
              { label: "RBAC roles", store: "PostgreSQL users table", color: "#0EA5E9" },
            ].map((item, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 8px", marginBottom: 3,
                background: i % 2 === 0 ? "#070B14" : "transparent",
                borderRadius: 4,
              }}>
                <span style={{ fontSize: 10, color: P.muted, fontFamily: FONT }}>{item.label}</span>
                <span style={{
                  fontSize: 9, color: item.color, fontFamily: FONT,
                  padding: "2px 6px", background: item.color + "15", borderRadius: 3,
                }}>{item.store}</span>
              </div>
            ))}
          </div>

          {/* Golden rule */}
          <div style={{
            background: "linear-gradient(135deg, #0F2A1A, #070B14)",
            border: "1px solid #10B98140", borderRadius: 10, padding: 14,
          }}>
            <div style={{ fontSize: 9, color: "#10B981", fontWeight: 800, letterSpacing: "0.1em", marginBottom: 8 }}>
              THE GOLDEN RULE
            </div>
            <div style={{ fontSize: 11, color: "#6EE7B7", fontFamily: FONT, lineHeight: 1.7 }}>
              PostgreSQL is your system of record. Redis can always be flushed and rebuilt. Clerk owns identity. Everything else is derived.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}