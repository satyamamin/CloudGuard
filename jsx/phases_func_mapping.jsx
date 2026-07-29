import { useState } from "react";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const phases = [
  {
    id: "p0",
    phase: "PHASE 0",
    label: "Environment Setup",
    days: "Pre-Day 1",
    color: "#64748B",
    glow: "#64748B30",
    accent: "#94A3B8",
    icon: "⬡",
    functionalGoal: "Developer machine is a complete, verified CloudGuard 360 development environment",
    goalShort: "Ready to Code",
    userStory: "As a developer, I can run the full stack locally with one command and connect to a real Azure subscription without writing any application code.",
    tools: ["Node.js 20 + pnpm", "VS Code + extensions", "Docker Desktop", "PostgreSQL + TimescaleDB", "Redis", "Azure CLI (az login)", "Terraform", "Git"],
    deliverables: [
      { label: "All 12 env checks pass", type: "verify" },
      { label: "docker compose up -d runs clean", type: "verify" },
      { label: "az consumption usage list returns real data", type: "verify" },
      { label: "Local DB accessible via Prisma Studio", type: "verify" },
    ],
    functional: [
      { goal: "Azure Connectivity", detail: "Can authenticate to Azure and call Cost Management API from local machine", met: true },
      { goal: "Database Ready", detail: "PostgreSQL + TimescaleDB running in Docker, accepting connections", met: true },
      { goal: "Cache Ready", detail: "Redis running locally on port 6379", met: true },
      { goal: "Build Toolchain", detail: "TypeScript compiles, pnpm workspaces resolve, tsc --noEmit passes", met: true },
    ],
    notYet: ["No application code", "No UI", "No API", "No multi-tenancy"],
    stackLayer: "Infrastructure Only",
  },
  {
    id: "p1",
    phase: "PHASE 1",
    label: "Monorepo Scaffold",
    days: "Days 1–3",
    color: "#0EA5E9",
    glow: "#0EA5E930",
    accent: "#38BDF8",
    icon: "⬡",
    functionalGoal: "A running monorepo where both apps start, share types, and connect to the database — with zero business logic",
    goalShort: "Skeleton Runs",
    userStory: "As a developer, I can run both Next.js and NestJS simultaneously, import shared types between them, and see the database tables via Prisma Studio.",
    tools: ["Next.js 14 + App Router", "NestJS 10", "packages/shared (Zod)", "Prisma ORM", "Turborepo", "pnpm workspaces"],
    deliverables: [
      { label: "pnpm dev starts web (3000) + api (3001)", type: "verify" },
      { label: "No TypeScript errors across monorepo", type: "verify" },
      { label: "Prisma Studio shows Tenant + Connector tables", type: "verify" },
      { label: "packages/shared types importable in both apps", type: "verify" },
    ],
    functional: [
      { goal: "Project Structure", detail: "apps/web, apps/api, packages/shared — all linked via pnpm workspaces", met: true },
      { goal: "Database Schema", detail: "Tenant and Connector tables created via Prisma migration", met: true },
      { goal: "Shared Contracts", detail: "DTOs and Zod schemas in packages/shared, importable everywhere", met: true },
      { goal: "Dev Server", detail: "Both apps hot-reload on file save, TypeScript strict mode enabled", met: true },
    ],
    notYet: ["No auth", "No login UI", "No Azure SDK calls", "No real data", "No business logic"],
    stackLayer: "Structure + Database",
  },
  {
    id: "p2",
    phase: "PHASE 2",
    label: "Auth + Tenant + Connector",
    days: "Days 4–10",
    color: "#8B5CF6",
    glow: "#8B5CF630",
    accent: "#A78BFA",
    icon: "⬡",
    functionalGoal: "A user can register, log in, and successfully connect their Azure subscription — with full multi-tenant isolation from day one",
    goalShort: "Login + Connect Azure",
    userStory: "As an enterprise user, I can sign up, create my organisation, connect my Azure subscription ID, and see confirmation that CloudGuard 360 has verified access to my Azure Cost Management data.",
    tools: ["Clerk (Auth + SSO)", "NestJS AuthGuard", "NestJS TenantGuard", "NestJS RolesGuard", "DefaultAzureCredential", "@azure/arm-costmanagement"],
    deliverables: [
      { label: "User can sign up and log in via Clerk", type: "functional" },
      { label: "Microsoft SSO (Entra ID) works", type: "functional" },
      { label: "Submit Azure Subscription ID → API verifies access", type: "functional" },
      { label: "Connector saved in DB with status active/failed", type: "functional" },
      { label: "All routes return 401 without valid JWT", type: "security" },
      { label: "All data scoped to tenant — no cross-tenant leakage", type: "security" },
    ],
    functional: [
      { goal: "User Registration", detail: "Email/password and Microsoft SSO signup via Clerk — zero custom auth code", met: true },
      { goal: "Multi-Tenant Foundation", detail: "Clerk orgId → internal tenantId mapping on every request via TenantGuard", met: true },
      { goal: "Azure Verification", detail: "DefaultAzureCredential queries Cost Management API to confirm subscription access", met: true },
      { goal: "Security Baseline", detail: "Auth + Tenant + Roles guards running on every NestJS route", met: true },
      { goal: "Real Azure Connection", detail: "First real Azure API call — connector stored with verified status", met: true },
    ],
    notYet: ["No cost data ingested yet", "No dashboard charts", "No jobs running", "No cached data"],
    stackLayer: "Identity + Security + Azure Auth",
  },
  {
    id: "p3",
    phase: "PHASE 3",
    label: "Real Data Pipeline",
    days: "Days 11–18",
    color: "#10B981",
    glow: "#10B98130",
    accent: "#34D399",
    icon: "⬡",
    functionalGoal: "Real Azure cost data flows automatically from the Azure Cost Management API into TimescaleDB and is served via cached API endpoints",
    goalShort: "Real Data Flowing",
    userStory: "As a FinOps analyst, I can trigger an Azure cost sync and within minutes have real spend data available via API — correctly scoped to my tenant, cached in Redis, queryable by service, date, and subscription.",
    tools: ["Trigger.dev (TS jobs)", "@azure/arm-costmanagement", "TimescaleDB hypertable", "Prisma (OLTP)", "Raw SQL (TimescaleDB)", "ioredis (caching)"],
    deliverables: [
      { label: "Trigger.dev job pulls real Azure cost data", type: "functional" },
      { label: "GET /finops/summary returns real MTD spend", type: "functional" },
      { label: "GET /finops/daily returns 30-day trend array", type: "functional" },
      { label: "GET /finops/by-service returns breakdown", type: "functional" },
      { label: "Redis caches responses (1hr TTL)", type: "functional" },
      { label: "Second request returns in <10ms (cache hit)", type: "performance" },
      { label: "All data filtered by tenantId — isolation verified", type: "security" },
    ],
    functional: [
      { goal: "Scheduled Ingestion", detail: "Trigger.dev job runs hourly per connector, pulls Azure cost records", met: true },
      { goal: "TimescaleDB Storage", detail: "cost_records hypertable with daily chunks, compressed after 7 days", met: true },
      { goal: "Cost Summary API", detail: "MTD total spend, top 5 services, budget utilisation — real numbers", met: true },
      { goal: "Trend API", detail: "30-day daily cost array ready for charting — all from real Azure data", met: true },
      { goal: "Performance Layer", detail: "Redis caches all dashboard queries with defined TTLs per data type", met: true },
      { goal: "Tenant Isolation", detail: "Every DB query includes WHERE tenant_id = $tenantId — no exceptions", met: true },
    ],
    notYet: ["No UI charts yet", "No frontend consuming this data", "No anomaly detection", "No Copilot"],
    stackLayer: "Data Pipeline + Storage + Cache",
  },
  {
    id: "p4",
    phase: "PHASE 4",
    label: "Dashboard UI",
    days: "Days 19–26",
    color: "#F59E0B",
    glow: "#F59E0B30",
    accent: "#FCD34D",
    icon: "⬡",
    functionalGoal: "A real user can log in, connect Azure, trigger sync, and see their actual Azure costs in an interactive dashboard — prototype complete",
    goalShort: "Working Prototype",
    userStory: "As an enterprise pilot user, I can open the browser, log in with my Microsoft account, add my Azure subscription, click Sync Now, and within minutes see my real Azure cloud spend broken down by service and date — with no mock data anywhere in the stack.",
    tools: ["Next.js App Router pages", "tRPC (type-safe API bridge)", "Recharts (charts)", "shadcn/ui (components)", "Clerk (session UI)", "Server-Sent Events"],
    deliverables: [
      { label: "Login page → dashboard redirect works", type: "functional" },
      { label: "Add Connector form → Azure verification flow", type: "functional" },
      { label: "Sync Now → Trigger.dev job → data appears in UI", type: "functional" },
      { label: "Cost summary card shows real MTD spend", type: "functional" },
      { label: "Daily trend LineChart with real 30-day data", type: "functional" },
      { label: "Service breakdown BarChart from real Azure data", type: "functional" },
      { label: "Second tenant sees NO data from first tenant", type: "security" },
      { label: "All data is real — zero mocks in the stack", type: "milestone" },
    ],
    functional: [
      { goal: "End-to-End User Flow", detail: "Register → login → connect Azure → sync → view costs — all working", met: true },
      { goal: "Real Cost Visualisation", detail: "MTD spend, daily trend, service breakdown — Recharts on real data", met: true },
      { goal: "Type-Safe Frontend", detail: "tRPC connects Next.js to NestJS — TypeScript errors on any API mismatch", met: true },
      { goal: "Tenant Isolation Verified", detail: "Two separate browser tabs, two orgs — zero data crossover confirmed", met: true },
      { goal: "Full Stack Real Data", detail: "Azure SDK → TimescaleDB → Redis → NestJS → tRPC → Next.js → Charts", met: true },
      { goal: "Prototype Complete", detail: "Every layer of the defined architecture is running with real Azure data", met: true },
    ],
    notYet: ["Anomaly detection (Month 2)", "Copilot/RAG (Month 2)", "Compliance scanning (Month 3)", "Stripe billing (before GA)"],
    stackLayer: "UI + End-to-End Integration",
  },
];

const functionalMilestones = [
  { phase: "P0", milestone: "Can call Azure Cost Management API from local machine", type: "infra" },
  { phase: "P1", milestone: "TypeScript monorepo compiles and both apps run simultaneously", type: "structure" },
  { phase: "P2", milestone: "First secure, multi-tenant user session with verified Azure access", type: "security" },
  { phase: "P3", milestone: "First real Azure cost record written to TimescaleDB", type: "data" },
  { phase: "P3", milestone: "GET /finops/summary returns real numbers (not mock data)", type: "data" },
  { phase: "P4", milestone: "Real user sees real Azure costs in browser — prototype complete", type: "product" },
];

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

const TAG_COLORS = {
  verify: { bg: "#0F2944", text: "#38BDF8", border: "#1E4A6B" },
  functional: { bg: "#0F2A1A", text: "#34D399", border: "#1A4A30" },
  security: { bg: "#2A1A2A", text: "#C084FC", border: "#4A2A4A" },
  performance: { bg: "#2A1F0A", text: "#FCD34D", border: "#4A3A0A" },
  milestone: { bg: "#2A1A0A", text: "#FB923C", border: "#4A2A0A" },
};

const MILESTONE_COLORS = {
  infra: "#64748B",
  structure: "#0EA5E9",
  security: "#8B5CF6",
  data: "#10B981",
  product: "#F59E0B",
};

function DeliverableTag({ label, type }) {
  const c = TAG_COLORS[type] || TAG_COLORS.functional;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 8,
      padding: "7px 10px", borderRadius: 6,
      background: c.bg, border: `1px solid ${c.border}`,
      marginBottom: 5,
    }}>
      <span style={{ color: c.text, fontSize: 11, marginTop: 1, flexShrink: 0, fontFamily: "monospace" }}>
        {type === "verify" ? "✓" : type === "security" ? "🔒" : type === "performance" ? "⚡" : type === "milestone" ? "★" : "→"}
      </span>
      <span style={{ fontSize: 11, color: "#CBD5E1", lineHeight: 1.5, fontFamily: "'IBM Plex Mono', monospace" }}>{label}</span>
    </div>
  );
}

function FunctionalGoalRow({ goal, detail, met }) {
  return (
    <div style={{
      display: "flex", gap: 10, padding: "9px 12px", marginBottom: 4,
      background: "#0A0F1E", borderRadius: 6, border: "1px solid #1E2D45",
      alignItems: "flex-start",
    }}>
      <span style={{ color: met ? "#10B981" : "#64748B", fontSize: 14, flexShrink: 0, marginTop: 1 }}>
        {met ? "◆" : "◇"}
      </span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#E2E8F0", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 2 }}>
          {goal}
        </div>
        <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5, fontFamily: "'IBM Plex Mono', monospace" }}>{detail}</div>
      </div>
    </div>
  );
}

function PhaseCard({ phase, isActive, onClick }) {
  const isComplete = phase.id === "p0" || phase.id === "p1";
  return (
    <button onClick={onClick} style={{
      width: "100%", textAlign: "left", cursor: "pointer",
      background: isActive ? phase.glow : "transparent",
      border: `1px solid ${isActive ? phase.color : "#1E2D45"}`,
      borderLeft: `4px solid ${phase.color}`,
      borderRadius: 8, padding: "12px 14px", marginBottom: 6,
      transition: "all 0.18s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{
            fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 3,
            background: phase.color + "25", color: phase.color,
            fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em",
          }}>{phase.phase}</span>
          <span style={{ fontSize: 9, color: "#64748B", fontFamily: "'IBM Plex Mono', monospace" }}>{phase.days}</span>
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: isActive ? "#E2E8F0" : "#94A3B8", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 4 }}>
        {phase.label}
      </div>
      <div style={{
        fontSize: 10, color: phase.color, fontFamily: "'IBM Plex Mono', monospace",
        fontWeight: 700, letterSpacing: "0.04em",
      }}>
        ◎ {phase.goalShort}
      </div>
    </button>
  );
}

function FlowArrow({ color }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "2px 0" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
        <div style={{ width: 2, height: 10, background: color + "60" }} />
        <div style={{ fontSize: 10, color: color + "80" }}>▼</div>
      </div>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState("p2");
  const activePhase = phases.find(p => p.id === active);

  return (
    <div style={{
      background: "#070B14", minHeight: "100vh",
      fontFamily: "'IBM Plex Mono', monospace", color: "#E2E8F0",
      padding: 20,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Bebas+Neue&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.18em", marginBottom: 4 }}>
          CLOUDGUARD 360 — PROTOTYPE ROADMAP
        </div>
        <h1 style={{
          margin: 0, fontFamily: "'Bebas Neue', sans-serif",
          fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "0.06em", lineHeight: 1,
          background: "linear-gradient(90deg, #0EA5E9, #8B5CF6, #10B981, #F59E0B)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          PHASE → FUNCTIONAL GOAL MAPPING
        </h1>
        <div style={{ fontSize: 10, color: "#334155", marginTop: 4 }}>
          What each phase delivers to the user — not just to the codebase
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 260px", gap: 16 }}>

        {/* LEFT — Phase list */}
        <div>
          <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.14em", marginBottom: 10 }}>
            SELECT PHASE
          </div>
          {phases.map((p, i) => (
            <div key={p.id}>
              <PhaseCard phase={p} isActive={active === p.id} onClick={() => setActive(p.id)} />
              {i < phases.length - 1 && <FlowArrow color={phases[i + 1].color} />}
            </div>
          ))}
        </div>

        {/* CENTER — Detail */}
        <div style={{
          background: "#0C1220", border: `1px solid #1E2D45`,
          borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 18,
        }}>
          {/* Phase header */}
          <div style={{
            borderBottom: `1px solid #1E2D45`, paddingBottom: 18,
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: "3px 10px", borderRadius: 4,
                  background: activePhase.color + "25", color: activePhase.color,
                  letterSpacing: "0.1em",
                }}>{activePhase.phase}</span>
                <span style={{ fontSize: 9, color: "#334155", marginLeft: 10 }}>{activePhase.days}</span>
              </div>
              <span style={{
                fontSize: 9, padding: "2px 8px", borderRadius: 4,
                background: "#1E2D45", color: "#64748B",
              }}>{activePhase.stackLayer}</span>
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "#E2E8F0", letterSpacing: "0.04em" }}>
              {activePhase.label.toUpperCase()}
            </div>
          </div>

          {/* Functional Goal */}
          <div style={{
            background: activePhase.color + "10",
            border: `1px solid ${activePhase.color}30`,
            borderRadius: 10, padding: "16px 18px",
          }}>
            <div style={{ fontSize: 9, color: activePhase.color, letterSpacing: "0.12em", fontWeight: 800, marginBottom: 8 }}>
              ◎ FUNCTIONAL GOAL
            </div>
            <div style={{ fontSize: 13, color: "#E2E8F0", lineHeight: 1.7, fontWeight: 500 }}>
              {activePhase.functionalGoal}
            </div>
          </div>

          {/* User Story */}
          <div style={{
            background: "#0A0F1E", border: "1px solid #1E2D45",
            borderLeft: `3px solid ${activePhase.color}`,
            borderRadius: 8, padding: "14px 16px",
          }}>
            <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.12em", marginBottom: 8 }}>USER STORY</div>
            <div style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.8, fontStyle: "italic" }}>
              "{activePhase.userStory}"
            </div>
          </div>

          {/* Two columns: Goals + Deliverables */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.12em", marginBottom: 10 }}>
                FUNCTIONAL GOALS MET
              </div>
              {activePhase.functional.map((f, i) => (
                <FunctionalGoalRow key={i} {...f} />
              ))}
            </div>
            <div>
              <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.12em", marginBottom: 10 }}>
                DELIVERABLES & CHECKS
              </div>
              {activePhase.deliverables.map((d, i) => (
                <DeliverableTag key={i} {...d} />
              ))}
            </div>
          </div>

          {/* Not yet */}
          <div style={{
            background: "#0A0A0A", border: "1px solid #1A1A2E",
            borderRadius: 8, padding: "12px 16px",
            display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
          }}>
            <span style={{ fontSize: 9, color: "#334155", letterSpacing: "0.1em", flexShrink: 0 }}>NOT YET:</span>
            {activePhase.notYet.map((n, i) => (
              <span key={i} style={{
                fontSize: 10, color: "#334155", padding: "2px 8px",
                borderRadius: 4, border: "1px solid #1A1A2E",
              }}>{n}</span>
            ))}
          </div>
        </div>

        {/* RIGHT — Timeline + Milestones */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Stack flow */}
          <div style={{
            background: "#0C1220", border: "1px solid #1E2D45",
            borderRadius: 10, padding: 16,
          }}>
            <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.14em", marginBottom: 14 }}>
              WHAT EACH PHASE UNLOCKS
            </div>
            {phases.map((p, i) => (
              <div key={p.id}>
                <div
                  onClick={() => setActive(p.id)}
                  style={{
                    padding: "10px 12px", borderRadius: 7, cursor: "pointer",
                    background: active === p.id ? p.color + "18" : "transparent",
                    border: `1px solid ${active === p.id ? p.color + "50" : "transparent"}`,
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: p.color, letterSpacing: "0.08em" }}>
                      {p.phase}
                    </span>
                    <span style={{ fontSize: 8, color: "#334155" }}>{p.days}</span>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: active === p.id ? "#E2E8F0" : "#64748B", marginBottom: 3 }}>
                    {p.goalShort}
                  </div>
                  <div style={{ fontSize: 9, color: "#334155", lineHeight: 1.4 }}>
                    {p.stackLayer}
                  </div>
                </div>
                {i < phases.length - 1 && (
                  <div style={{ width: 2, height: 8, background: phases[i+1].color + "40", margin: "2px auto" }} />
                )}
              </div>
            ))}
          </div>

          {/* Key Milestones */}
          <div style={{
            background: "#0C1220", border: "1px solid #1E2D45",
            borderRadius: 10, padding: 16, flex: 1,
          }}>
            <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.14em", marginBottom: 14 }}>
              KEY FUNCTIONAL MILESTONES
            </div>
            {functionalMilestones.map((m, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                padding: "9px 10px", borderRadius: 6, marginBottom: 5,
                background: "#070B14", border: `1px solid ${MILESTONE_COLORS[m.type]}20`,
                borderLeft: `3px solid ${MILESTONE_COLORS[m.type]}`,
              }}>
                <div style={{ flexShrink: 0, marginTop: 1 }}>
                  <div style={{
                    width: 28, height: 16, borderRadius: 3, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    background: MILESTONE_COLORS[m.type] + "20",
                    fontSize: 8, fontWeight: 800, color: MILESTONE_COLORS[m.type],
                  }}>{m.phase}</div>
                </div>
                <div style={{ fontSize: 10, color: "#64748B", lineHeight: 1.5 }}>{m.milestone}</div>
              </div>
            ))}

            {/* Final outcome */}
            <div style={{
              marginTop: 12, padding: "14px 14px",
              background: "linear-gradient(135deg, #0F2A1A, #070B14)",
              border: "1px solid #10B98140", borderRadius: 8,
            }}>
              <div style={{ fontSize: 9, color: "#10B981", letterSpacing: "0.12em", marginBottom: 6, fontWeight: 800 }}>
                ★ PROTOTYPE COMPLETE
              </div>
              <div style={{ fontSize: 11, color: "#6EE7B7", lineHeight: 1.6 }}>
                Login → connect Azure → sync → see real costs in browser
              </div>
              <div style={{ fontSize: 10, color: "#334155", marginTop: 6 }}>
                ~26 days from first command
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom — full stack flow */}
      <div style={{
        marginTop: 16, background: "#0C1220", border: "1px solid #1E2D45",
        borderRadius: 10, padding: "14px 20px",
      }}>
        <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.14em", marginBottom: 12 }}>
          FULL DATA FLOW — ACHIEVED AT PROTOTYPE COMPLETE
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap", rowGap: 8 }}>
          {[
            { label: "Azure ARM API", color: "#0EA5E9", phase: "P2" },
            { label: "DefaultAzureCredential", color: "#0EA5E9", phase: "P2" },
            { label: "Trigger.dev Job", color: "#10B981", phase: "P3" },
            { label: "TimescaleDB", color: "#10B981", phase: "P3" },
            { label: "Redis Cache", color: "#10B981", phase: "P3" },
            { label: "NestJS API", color: "#10B981", phase: "P3" },
            { label: "tRPC", color: "#F59E0B", phase: "P4" },
            { label: "Next.js", color: "#F59E0B", phase: "P4" },
            { label: "Recharts", color: "#F59E0B", phase: "P4" },
          ].map((item, i, arr) => (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              <div style={{
                padding: "5px 10px", borderRadius: 5,
                background: item.color + "15", border: `1px solid ${item.color}30`,
                fontSize: 10, color: item.color, fontWeight: 600,
              }}>
                {item.label}
                <span style={{ fontSize: 8, color: item.color + "70", marginLeft: 5 }}>{item.phase}</span>
              </div>
              {i < arr.length - 1 && (
                <div style={{ margin: "0 4px", color: "#1E2D45", fontSize: 12 }}>→</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}