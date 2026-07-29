import { useState } from "react";

/* ─── DESIGN SYSTEM ─────────────────────────────────────────────────────────
   Aesthetic: Mission control — warm amber on near-black, like a cockpit at night
   Fonts: Bebas Neue (display) + Space Mono (technical content)
   Color: Deep black base, amber accent, phase-specific colors, green success
──────────────────────────────────────────────────────────────────────────── */

const C = {
  bg: "#080808",
  surface: "#0E0E0E",
  card: "#141414",
  border: "#222222",
  borderBright: "#333333",
  amber: "#F59E0B",
  cyan: "#22D3EE",
  green: "#10B981",
  purple: "#A855F7",
  blue: "#3B82F6",
  red: "#EF4444",
  text: "#F5F0E8",
  muted: "#666666",
  dim: "#1A1A1A",
};

const PHASE_CONFIG = {
  p0: { label: "ENV SETUP",       days: "Pre-Day 1",  color: "#64748B", accent: "#94A3B8" },
  p1: { label: "MONOREPO",        days: "Days 1–3",   color: "#22D3EE", accent: "#67E8F9" },
  p2: { label: "AUTH + AZURE",    days: "Days 4–10",  color: "#A855F7", accent: "#C084FC" },
  p3: { label: "DATA PIPELINE",   days: "Days 11–18", color: "#10B981", accent: "#34D399" },
  p4: { label: "DASHBOARD",       days: "Days 19–26", color: "#F59E0B", accent: "#FCD34D" },
};

/* ─── VERTICAL NAV ITEMS ─────────────────────────────────────────────────── */
const VERTICAL_NAV = [
  { id: "p0", icon: "⬡", label: "Phase 0", sub: "Environment" },
  { id: "p1", icon: "⬢", label: "Phase 1", sub: "Monorepo" },
  { id: "p2", icon: "◈", label: "Phase 2", sub: "Auth + Azure" },
  { id: "p3", icon: "◉", label: "Phase 3", sub: "Data Pipeline" },
  { id: "p4", icon: "◆", label: "Phase 4", sub: "Dashboard" },
];

/* ─── HORIZONTAL SUB-NAV per phase ─────────────────────────────────────────
   Each phase has its own tabs rendered in the horizontal top bar
──────────────────────────────────────────────────────────────────────────── */
const SUB_NAV = {
  p0: [
    { id: "accounts",  label: "Accounts" },
    { id: "runtimes",  label: "Runtimes" },
    { id: "vscode",    label: "VS Code" },
    { id: "docker",    label: "Docker" },
    { id: "azure",     label: "Azure CLI" },
    { id: "git",       label: "Git & Terraform" },
    { id: "verify",    label: "Verification" },
  ],
  p1: [
    { id: "structure", label: "Structure" },
    { id: "scaffold",  label: "Scaffold Apps" },
    { id: "prisma",    label: "Prisma" },
    { id: "envfiles",  label: "Env Files" },
  ],
  p2: [
    { id: "clerk",     label: "Clerk Setup" },
    { id: "guards",    label: "Auth Guards" },
    { id: "connector", label: "Azure Connector" },
    { id: "complete",  label: "Done When" },
  ],
  p3: [
    { id: "timescale", label: "TimescaleDB" },
    { id: "jobs",      label: "Trigger.dev Job" },
    { id: "api",       label: "API Endpoints" },
    { id: "cache",     label: "Redis Cache" },
  ],
  p4: [
    { id: "trpc",      label: "tRPC" },
    { id: "pages",     label: "Dashboard Pages" },
    { id: "libs",      label: "Libraries" },
    { id: "e2e",       label: "End-to-End Test" },
  ],
};

/* ─── SHARED COMPONENTS ──────────────────────────────────────────────────── */

const Tag = ({ children, color = C.amber }) => (
  <span style={{
    fontSize: 10, padding: "2px 8px", borderRadius: 2,
    background: color + "20", color, border: `1px solid ${color}35`,
    fontFamily: "Space Mono, monospace", letterSpacing: "0.05em", display: "inline-block",
    marginRight: 4, marginBottom: 3,
  }}>{children}</span>
);

const CodeBlock = ({ children, label = null, color = C.amber }) => (
  <div style={{ margin: "10px 0" }}>
    {label && (
      <div style={{ fontSize: 9, color, fontFamily: "Space Mono, monospace", letterSpacing: "0.12em", marginBottom: 6, fontWeight: 700 }}>
        {label}
      </div>
    )}
    <div style={{
      background: "#030303", border: `1px solid ${color}20`,
      borderRadius: 6, padding: "14px 16px", overflowX: "auto",
    }}>
      <pre style={{ margin: 0, fontSize: 11, color: "#7DD3FC", fontFamily: "Space Mono, monospace", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>
        {children}
      </pre>
    </div>
  </div>
);

const Checklist = ({ items, color = C.green }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {items.map((item, i) => (
      <div key={i} style={{
        display: "flex", gap: 10, padding: "9px 12px",
        background: C.card, border: `1px solid ${color}20`,
        borderRadius: 6, alignItems: "flex-start",
      }}>
        <span style={{ color, fontSize: 12, flexShrink: 0, fontFamily: "Space Mono, monospace", marginTop: 1 }}>☐</span>
        <span style={{ fontSize: 11, color: C.text, fontFamily: "Space Mono, monospace", lineHeight: 1.6 }}>{item}</span>
      </div>
    ))}
  </div>
);

const DataTable = ({ headers, rows, color = C.amber }) => (
  <div style={{ overflowX: "auto", borderRadius: 7, border: `1px solid ${C.border}` }}>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: color + "15" }}>
          {headers.map((h, i) => (
            <th key={i} style={{
              padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700,
              color, fontFamily: "Space Mono, monospace", letterSpacing: "0.08em",
              borderBottom: `1px solid ${color}25`,
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
                fontFamily: "Space Mono, monospace", lineHeight: 1.5,
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

const Alert = ({ type = "info", children, color }) => {
  const colors = { info: C.cyan, warn: C.amber, danger: C.red, success: C.green };
  const c = color || colors[type];
  return (
    <div style={{
      background: c + "10", border: `1px solid ${c}30`,
      borderLeft: `4px solid ${c}`, borderRadius: 7, padding: "12px 16px", margin: "10px 0",
    }}>
      <div style={{ fontSize: 11, color: c, fontFamily: "Space Mono, monospace", lineHeight: 1.7 }}>{children}</div>
    </div>
  );
};

const Step = ({ num, title, body, color = C.amber }) => (
  <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
    <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: color + "20", border: `2px solid ${color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700, color, fontFamily: "Space Mono, monospace",
      }}>{num}</div>
    </div>
    <div style={{ flex: 1, paddingTop: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "Bebas Neue, sans-serif", letterSpacing: "0.06em", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 11, color: C.muted, fontFamily: "Space Mono, monospace", lineHeight: 1.7 }}>{body}</div>
    </div>
  </div>
);

/* ─── P0 TABS ────────────────────────────────────────────────────────────── */

function P0Accounts() {
  const accounts = [
    ["Microsoft Azure", "Real cost data, SDK target, Azure hosting", "portal.azure.com"],
    ["GitHub", "Source control, CI/CD via Actions", "github.com"],
    ["Clerk", "Authentication, SSO, org management", "clerk.com"],
    ["Vercel", "Frontend hosting (Next.js)", "vercel.com"],
    ["Trigger.dev", "TypeScript background jobs", "trigger.dev"],
    ["Neon / Supabase", "PostgreSQL cloud DB for local dev (free tier)", "neon.tech or supabase.com"],
  ];
  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, fontFamily: "Space Mono, monospace", marginBottom: 20, lineHeight: 1.8 }}>
        Create all six accounts before installing any tooling. All free tiers are sufficient for prototype development.
      </div>
      <DataTable headers={["Service", "Purpose in CloudGuard 360", "URL"]} rows={accounts} color={"#64748B"} />
      <Alert type="warn">
        <strong style={{ color: C.amber }}>AZURE SUBSCRIPTION NOTE —</strong> You need at least one Azure subscription with <strong>Cost Management Reader</strong> role on your account.
        A free Azure account includes $200 credit. Note your Subscription ID — needed in Phase 2.
      </Alert>
    </div>
  );
}

function P0Runtimes() {
  return (
    <div>
      <Step num="1" title="Node.js via NVM (Node Version Manager)" color="#64748B"
        body="Never install Node.js directly from nodejs.org on a dev machine. Use NVM so you can switch Node versions per project." />
      <CodeBlock label="INSTALL NVM FOR WINDOWS" color="#64748B">{`winget install -e --id CoreyButler.NVMforWindows
# Restart terminal, then:
nvm install 20.11.0
nvm use 20.11.0
node --version        # Expected: v20.11.0
npm --version         # Expected: 10.x.x`}</CodeBlock>

      <Step num="2" title="pnpm (Package Manager)" color="#64748B"
        body="pnpm is faster than npm, uses less disk space, and is the standard for monorepos. CloudGuard 360 uses pnpm workspaces throughout." />
      <CodeBlock label="INSTALL PNPM" color="#64748B">{`npm install -g pnpm
pnpm --version        # Expected: 8.x.x or 9.x.x`}</CodeBlock>

      <Step num="3" title="TypeScript & ts-node globally" color="#64748B" body="Required for type-checking and running TypeScript files directly." />
      <CodeBlock label="INSTALL TYPESCRIPT TOOLING" color="#64748B">{`npm install -g typescript ts-node tsx
tsc --version         # Expected: Version 5.x.x`}</CodeBlock>
    </div>
  );
}

function P0VSCode() {
  const extensions = [
    ["VS Code", "Latest stable", "code --version"],
    ["ESLint", "dbaeumer.vscode-eslint", "Extensions panel"],
    ["Prettier", "esbenp.prettier-vscode", "Extensions panel"],
    ["Prisma", "Prisma.prisma", "Extensions panel"],
    ["Tailwind CSS IntelliSense", "bradlc.vscode-tailwindcss", "Extensions panel"],
    ["TypeScript Importer", "pmneo.tsimporter", "Extensions panel"],
    ["REST Client", "humao.rest-client", "Replaces Postman"],
    ["Azure Tools", "ms-vscode.vscode-node-azure-pack", "Extensions panel"],
    ["GitLens", "eamodio.gitlens", "Extensions panel"],
    ["Error Lens", "usernamehw.errorlens", "Extensions panel"],
  ];
  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, fontFamily: "Space Mono, monospace", marginBottom: 16, lineHeight: 1.8 }}>
        VS Code is the only IDE with first-class TypeScript, NestJS, Prisma, and Azure support. Install all extensions before opening the project.
      </div>
      <DataTable headers={["Tool", "ID / Version", "Verify"]} rows={extensions} color={"#64748B"} />
      <CodeBlock label="ADD TO settings.json" color="#64748B">{`{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "editor.codeActionsOnSave": { "source.fixAll.eslint": true }
}`}</CodeBlock>
    </div>
  );
}

function P0Docker() {
  return (
    <div>
      <Alert type="warn">Docker Desktop runs PostgreSQL + TimescaleDB and Redis locally. This is essential — NEVER install these databases directly on Windows.</Alert>
      <CodeBlock label="INSTALL DOCKER DESKTOP" color="#64748B">{`winget install -e --id Docker.DockerDesktop
# Restart PC after install
docker --version        # Expected: Docker version 25.x.x
docker compose version  # Expected: Docker Compose version v2.x.x`}</CodeBlock>
      <CodeBlock label="docker-compose.yml — Save to project root" color="#64748B">{`version: "3.8"
services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: cloudguard
      POSTGRES_USER: cloudguard
      POSTGRES_PASSWORD: localdev123
    volumes: [pgdata:/var/lib/postgresql/data]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
volumes:
  pgdata:`}</CodeBlock>
      <CodeBlock label="START LOCAL DATABASES" color="#64748B">{`docker compose up -d
docker compose ps     # Both services should show "running"`}</CodeBlock>
    </div>
  );
}

function P0Azure() {
  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, fontFamily: "Space Mono, monospace", marginBottom: 16, lineHeight: 1.8 }}>
        Azure CLI is required for local development with DefaultAzureCredential — the same auth mechanism used in production.
        Your local <code style={{ color: C.cyan }}>az login</code> session IS your credential. No secrets needed locally.
      </div>
      <CodeBlock label="INSTALL AND AUTHENTICATE" color="#64748B">{`winget install -e --id Microsoft.AzureCLI
az --version          # Expected: azure-cli 2.57.x

# Login — opens browser for Microsoft auth
az login

# Set your default subscription
az account set --subscription "YOUR-SUBSCRIPTION-ID"

# Verify — should show your subscription details
az account show

# Test Cost Management access
az consumption usage list --top 5`}</CodeBlock>
      <Alert type="danger">
        <strong style={{ color: C.red }}>CRITICAL — Assign Cost Management Reader Role</strong><br/>
        Your Azure account needs "Cost Management Reader" on the subscription.<br/><br/>
        <code>{`$subId = az account show --query id -o tsv`}</code><br/>
        <code>{`az role assignment create --role "Cost Management Reader" --assignee (az account show --query user.name -o tsv) --scope "/subscriptions/$subId"`}</code>
      </Alert>
    </div>
  );
}

function P0Git() {
  return (
    <div>
      <CodeBlock label="CONFIGURE GIT" color="#64748B">{`winget install -e --id Git.Git
git --version         # Expected: git version 2.43.x

git config --global user.name "Your Name"
git config --global user.email "your@email.com"
git config --global core.autocrlf false
git config --global init.defaultBranch main`}</CodeBlock>
      <div style={{ marginTop: 20 }}>
        <CodeBlock label="INSTALL TERRAFORM" color="#64748B">{`winget install -e --id Hashicorp.Terraform
terraform --version   # Expected: Terraform v1.7.x`}</CodeBlock>
      </div>
    </div>
  );
}

function P0Verify() {
  const checks = [
    ["Node.js 20.x", "v20.11.0", "node --version"],
    ["pnpm 8.x+", "pnpm 8.x or 9.x", "pnpm --version"],
    ["TypeScript 5.x", "Version 5.x.x", "tsc --version"],
    ["Docker Desktop", "Running + Engine active", "docker info"],
    ["PostgreSQL (Docker)", "Listening on 5432", "docker compose ps"],
    ["Redis (Docker)", "Listening on 6379", "docker compose ps"],
    ["Azure CLI", "2.57.x+", "az --version"],
    ["Azure Login", "Subscription visible", "az account show"],
    ["Cost Management", "Returns usage rows", "az consumption usage list --top 1"],
    ["Git", "2.43.x+", "git --version"],
    ["Terraform", "1.7.x+", "terraform --version"],
    ["VS Code", "Latest", "code --version"],
  ];
  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, fontFamily: "Space Mono, monospace", marginBottom: 16, lineHeight: 1.8 }}>
        Run every command below. ALL 12 must pass before writing a single line of product code.
      </div>
      <DataTable headers={["Tool", "Expected Version", "Verify Command"]} rows={checks} color={"#64748B"} />
      <Alert type="success">
        <strong style={{ color: C.green }}>✅ PHASE 0 COMPLETE WHEN —</strong><br/>
        • All 12 checks above show green<br/>
        • <code>az consumption usage list --top 1</code> returns real data from your Azure subscription<br/>
        • <code>docker compose ps</code> shows both postgres and redis as "running"<br/>
        • You are ready to scaffold the monorepo
      </Alert>
    </div>
  );
}

/* ─── P1 TABS ────────────────────────────────────────────────────────────── */

function P1Structure() {
  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, fontFamily: "Space Mono, monospace", marginBottom: 16, lineHeight: 1.8 }}>
        Goal: an empty but fully configured monorepo where every tool works, linting passes, and all packages can see each other's types. No business logic.
      </div>
      <CodeBlock label="SCAFFOLD THE REPO" color={C.cyan}>{`mkdir cloudguard360 && cd cloudguard360
git init
pnpm init`}</CodeBlock>
      <CodeBlock label="DIRECTORY STRUCTURE TO CREATE" color={C.cyan}>{`cloudguard360/
  apps/
    web/          ← Next.js 14 frontend (port 3000)
    api/          ← NestJS backend (port 3001)
  packages/
    shared/       ← Types, DTOs, Zod schemas — used by both apps
  infra/          ← Terraform files
  docker-compose.yml
  pnpm-workspace.yaml
  turbo.json
  .gitignore`}</CodeBlock>
      <CodeBlock label="pnpm-workspace.yaml" color={C.cyan}>{`packages:
  - "apps/*"
  - "packages/*"`}</CodeBlock>
      <CodeBlock label="ADD TURBOREPO" color={C.cyan}>{`pnpm add -D turbo -w`}</CodeBlock>
    </div>
  );
}

function P1Scaffold() {
  return (
    <div>
      <CodeBlock label="NEXT.JS 14 FRONTEND" color={C.cyan}>{`cd apps
pnpm create next-app@14 web \\
  --typescript --tailwind --eslint \\
  --app --src-dir --import-alias "@/*"
cd web && pnpm add @clerk/nextjs`}</CodeBlock>

      <CodeBlock label="NESTJS BACKEND" color={C.cyan}>{`cd apps
pnpm dlx @nestjs/cli new api --package-manager pnpm
cd api
pnpm add @nestjs/config @nestjs/jwt @nestjs/throttler
pnpm add @prisma/client @azure/arm-costmanagement
pnpm add @azure/arm-resourcegraph @azure/identity
pnpm add ioredis @trpc/server zod
pnpm add -D prisma @types/node`}</CodeBlock>

      <CodeBlock label="PACKAGES/SHARED" color={C.cyan}>{`mkdir -p packages/shared/src
cd packages/shared
pnpm init
# package.json name: "@cloudguard/shared"
# Create src/index.ts exporting types, DTOs, Zod schemas
pnpm add zod
pnpm add -D typescript`}</CodeBlock>
    </div>
  );
}

function P1Prisma() {
  return (
    <div>
      <CodeBlock label="INITIALISE PRISMA" color={C.cyan}>{`cd apps/api
pnpm dlx prisma init --datasource-provider postgresql`}</CodeBlock>

      <CodeBlock label="MINIMAL PRISMA SCHEMA FOR PHASE 1" color={C.cyan}>{`generator client {
  provider = "prisma-client-js"
}
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Tenant {
  id          String      @id @default(uuid())
  clerkOrgId  String      @unique
  name        String
  createdAt   DateTime    @default(now())
  connectors  Connector[]
}

model Connector {
  id             String   @id @default(uuid())
  tenantId       String
  tenant         Tenant   @relation(fields: [tenantId], references: [id])
  subscriptionId String
  displayName    String
  status         String   @default("active")
  createdAt      DateTime @default(now())
}`}</CodeBlock>

      <CodeBlock label="RUN FIRST MIGRATION" color={C.cyan}>{`pnpm dlx prisma migrate dev --name init
pnpm dlx prisma generate
# Open Prisma Studio to verify tables:
pnpm dlx prisma studio`}</CodeBlock>
      <Alert type="success">Prisma Studio should show Tenant and Connector tables. If it does, the database connection is working.</Alert>
    </div>
  );
}

function P1EnvFiles() {
  return (
    <div>
      <Alert type="danger">NEVER commit .env or .env.local files to git. Add both to .gitignore immediately.</Alert>
      <CodeBlock label="apps/api/.env" color={C.cyan}>{`DATABASE_URL="postgresql://cloudguard:localdev123@localhost:5432/cloudguard"
REDIS_URL="redis://localhost:6379"
CLERK_SECRET_KEY="sk_test_xxxx"       # from clerk.com dashboard
AZURE_SUBSCRIPTION_ID="your-sub-id"
PORT=3001`}</CodeBlock>
      <CodeBlock label="apps/web/.env.local" color={C.cyan}>{`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_xxxx"
CLERK_SECRET_KEY="sk_test_xxxx"
NEXT_PUBLIC_API_URL="http://localhost:3001"`}</CodeBlock>
      <Alert type="success">
        <strong style={{ color: C.green }}>✅ PHASE 1 COMPLETE WHEN —</strong><br/>
        • <code>pnpm dev</code> starts both Next.js (3000) and NestJS (3001) without errors<br/>
        • Prisma Studio shows Tenant and Connector tables in local PostgreSQL<br/>
        • <code>packages/shared</code> types importable from both apps<br/>
        • No TypeScript errors: <code>tsc --noEmit</code> passes in each app
      </Alert>
    </div>
  );
}

/* ─── P2 TABS ────────────────────────────────────────────────────────────── */

function P2Clerk() {
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {[
          "Create a Clerk application at clerk.com",
          "Enable Microsoft / Entra ID as a social provider in Clerk dashboard",
          "Create an Organisation — this maps to a Tenant in CloudGuard 360",
          "Copy Publishable Key and Secret Key to .env files",
          "Set redirect URLs: http://localhost:3000 for development",
        ].map((s, i) => <Step key={i} num={i + 1} title="" body={s} color={C.purple} />)}
      </div>
      <CodeBlock label="apps/web/src/middleware.ts" color={C.purple}>{`import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) auth().protect();
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};`}</CodeBlock>
    </div>
  );
}

function P2Guards() {
  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, fontFamily: "Space Mono, monospace", marginBottom: 16, lineHeight: 1.8 }}>
        Two guards run on every request. AuthGuard validates the Clerk JWT. TenantGuard resolves the internal tenantId from the Clerk orgId and attaches it to the request context.
      </div>
      <CodeBlock label="AUTH GUARD — validates Clerk JWT on every request" color={C.purple}>{`@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) throw new UnauthorizedException();
    const payload = await clerkClient.verifyToken(token);
    req.userId = payload.sub;
    req.orgId  = payload.org_id;
    return true;
  }
}`}</CodeBlock>
      <CodeBlock label="TENANT GUARD — resolves tenantId from orgId" color={C.purple}>{`@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private tenantService: TenantService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const tenant = await this.tenantService.resolveByClerkOrg(req.orgId);
    req.tenantId = tenant.id;
    return true;
  }
}`}</CodeBlock>
    </div>
  );
}

function P2Connector() {
  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, fontFamily: "Space Mono, monospace", marginBottom: 16, lineHeight: 1.8 }}>
        The user provides their Azure Subscription ID. The API stores it, then immediately verifies connectivity using DefaultAzureCredential.
      </div>
      <CodeBlock label="CONNECTOR SERVICE — verify Azure access" color={C.purple}>{`import { DefaultAzureCredential } from "@azure/identity";
import { CostManagementClient } from "@azure/arm-costmanagement";

async verifyConnector(subscriptionId: string): Promise<boolean> {
  const credential = new DefaultAzureCredential();
  const client = new CostManagementClient(credential);
  try {
    await client.query.usage(
      \`/subscriptions/\${subscriptionId}\`,
      {
        type: "Usage", timeframe: "Custom",
        timePeriod: { from: yesterday(), to: today() },
        dataset: {
          granularity: "Daily",
          aggregation: { totalCost: { name: "Cost", function: "Sum" } }
        }
      }
    );
    return true;
  } catch { return false; }
}`}</CodeBlock>
      <Alert type="warn">
        <strong style={{ color: C.amber }}>DefaultAzureCredential locally = your az login session.</strong><br/>
        Locally: uses your <code>az login</code> session automatically. No secrets needed.<br/>
        In Azure Container Apps: uses Workload Identity automatically.<br/>
        NEVER use ClientSecretCredential. NEVER hardcode subscription secrets.
      </Alert>
    </div>
  );
}

function P2Complete() {
  return (
    <div>
      <Checklist color={C.purple} items={[
        "User can sign up and log in via Clerk email/password",
        "Microsoft SSO (Entra ID) login works",
        "User can submit an Azure Subscription ID via a form",
        "API calls DefaultAzureCredential, queries Cost Management, returns success/fail",
        "Connector record saved in PostgreSQL with status 'active' or 'failed'",
        "All API routes return 401 without a valid Clerk JWT",
        "All data scoped to tenant — no cross-tenant leakage possible",
      ]} />
      <Alert type="success">
        <strong style={{ color: C.green }}>✅ PHASE 2 COMPLETE WHEN —</strong><br/>
        First real Azure API call has been made from your application using DefaultAzureCredential.
        Multi-tenant foundation is solid. Every subsequent feature builds on this.
      </Alert>
    </div>
  );
}

/* ─── P3 TABS ────────────────────────────────────────────────────────────── */

function P3Timescale() {
  return (
    <div>
      <CodeBlock label="ENABLE TIMESCALEDB EXTENSION" color={C.green}>{`# Connect to your local DB
docker exec -it cloudguard360_postgres_1 psql -U cloudguard -d cloudguard

-- Inside psql:
CREATE EXTENSION IF NOT EXISTS timescaledb;
\\q`}</CodeBlock>

      <CodeBlock label="ADD cost_records TO PRISMA SCHEMA" color={C.green}>{`model CostRecord {
  id             String   @id @default(uuid())
  tenantId       String
  connectorId    String
  time           DateTime
  serviceName    String
  amount         Float
  currency       String   @default("USD")
  subscriptionId String
  resourceGroup  String   @default("")
  tags           Json?
  @@index([tenantId, time])
}`}</CodeBlock>

      <CodeBlock label="MIGRATE THEN CONVERT TO HYPERTABLE" color={C.green}>{`pnpm dlx prisma migrate dev --name add-cost-records

# Convert to TimescaleDB hypertable:
docker exec -it cloudguard360_postgres_1 \\
  psql -U cloudguard -d cloudguard -c \\
  "SELECT create_hypertable('CostRecord', 'time');"

# Add compression policy:
# SELECT add_compression_policy('CostRecord', INTERVAL '7 days');`}</CodeBlock>
    </div>
  );
}

function P3Jobs() {
  return (
    <div>
      <CodeBlock label="INSTALL TRIGGER.DEV SDK" color={C.green}>{`cd apps/api
pnpm add @trigger.dev/sdk
# Create project at trigger.dev, copy API key to .env:
# TRIGGER_API_KEY="tr_dev_xxxx"
# TRIGGER_API_URL="https://api.trigger.dev"`}</CodeBlock>

      <CodeBlock label="INGESTION JOB — apps/api/src/jobs/ingest-azure-costs.ts" color={C.green}>{`import { task } from "@trigger.dev/sdk/v3";
import { DefaultAzureCredential } from "@azure/identity";
import { CostManagementClient } from "@azure/arm-costmanagement";

export const ingestAzureCosts = task({
  id: "ingest-azure-costs",
  run: async (payload: {
    connectorId: string;
    subscriptionId: string;
    tenantId: string;
  }) => {
    const credential = new DefaultAzureCredential();
    const client = new CostManagementClient(credential);
    const scope = \`/subscriptions/\${payload.subscriptionId}\`;

    const result = await client.query.usage(scope, {
      type: "Usage",
      timeframe: "MonthToDate",
      dataset: {
        granularity: "Daily",
        grouping: [{ type: "Dimension", name: "ServiceName" }],
        aggregation: { totalCost: { name: "Cost", function: "Sum" } }
      }
    });

    // Normalise and write to PostgreSQL via Prisma
    await writeRecords(result, payload);
    return { rowsIngested: result.rows?.length ?? 0 };
  }
});`}</CodeBlock>
    </div>
  );
}

function P3API() {
  const endpoints = [
    ["GET", "/finops/summary", "Total spend MTD, by service top-5, % vs last month"],
    ["GET", "/finops/daily", "Daily cost trend for last 30 days — array of {date, amount}"],
    ["GET", "/finops/by-service", "Cost breakdown by Azure service for bar chart"],
    ["GET", "/finops/connectors", "List connectors with status and last sync time"],
    ["POST", "/finops/connectors", "Add new Azure subscription connector"],
    ["POST", "/finops/sync/:id", "Trigger manual ingestion job for connector"],
  ];
  return (
    <div>
      <DataTable headers={["Method", "Endpoint", "Returns"]} rows={endpoints} color={C.green} />
      <Alert type="danger">
        <strong style={{ color: C.red }}>ALL queries MUST include tenantId filter:</strong>
        <CodeBlock color={C.green}>{`// CORRECT — always scope to tenant
const records = await prisma.costRecord.findMany({
  where: { tenantId: req.tenantId, time: { gte: startOfMonth() } },
  orderBy: { time: "asc" }
});

// WRONG — never query without tenantId
const records = await prisma.costRecord.findMany(); // NEVER`}</CodeBlock>
      </Alert>
    </div>
  );
}

function P3Cache() {
  return (
    <div>
      <CodeBlock label="REDIS CACHING PATTERN — ioredis" color={C.green}>{`import Redis from "ioredis";
const redis = new Redis(process.env.REDIS_URL);

async getSummary(tenantId: string) {
  const key = \`cost:summary:\${tenantId}\`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const data = await this.computeSummary(tenantId);
  await redis.setex(key, 3600, JSON.stringify(data)); // 1hr TTL
  return data;
}`}</CodeBlock>
      <div style={{ marginTop: 16 }}>
        <DataTable
          headers={["Key Pattern", "TTL", "Invalidate When"]}
          rows={[
            ["cost:summary:{tenantId}", "60 min", "New ingestion batch completes"],
            ["cost:daily:{tenantId}", "60 min", "New ingestion batch completes"],
            ["cost:services:{tenantId}", "60 min", "New ingestion batch completes"],
            ["connector:status:{id}", "5 min", "Each sync attempt"],
          ]}
          color={C.green}
        />
      </div>
      <Alert type="success">
        <strong style={{ color: C.green }}>✅ PHASE 3 COMPLETE WHEN —</strong><br/>
        • Trigger.dev job pulls real Azure cost data on demand<br/>
        • GET /finops/summary returns real numbers — not mock data<br/>
        • Second request returns in &lt;10ms (cache hit)<br/>
        • All data filtered by tenantId — no cross-tenant leakage
      </Alert>
    </div>
  );
}

/* ─── P4 TABS ────────────────────────────────────────────────────────────── */

function P4tRPC() {
  return (
    <div>
      <CodeBlock label="INSTALL TRPC IN BOTH APPS" color={C.amber}>{`cd apps/api  && pnpm add @trpc/server
cd apps/web  && pnpm add @trpc/client @trpc/react-query @tanstack/react-query`}</CodeBlock>
      <Alert type="info">
        <strong style={{ color: C.cyan }}>WHY tRPC MATTERS HERE —</strong><br/>
        Without tRPC: you manually keep API response types in sync between frontend and backend.<br/>
        With tRPC: change a field in your NestJS router → TypeScript error in your React component immediately.<br/>
        No manual sync. No runtime surprises. This is packages/shared + tRPC working as designed.<br/><br/>
        Type safety flows: PostgreSQL schema → Prisma → NestJS → tRPC → React component
      </Alert>
    </div>
  );
}

function P4Pages() {
  const pages = [
    ["/dashboard", "CostSummaryCard", "GET /finops/summary → total MTD spend, top 3 services"],
    ["/dashboard", "DailyTrendChart", "GET /finops/daily → Recharts LineChart, last 30 days"],
    ["/dashboard", "ServiceBreakdown", "GET /finops/by-service → Recharts BarChart"],
    ["/connectors", "ConnectorList", "GET /finops/connectors → status, last sync time"],
    ["/connectors/add", "AddConnectorForm", "POST /finops/connectors → subscription ID + verify"],
    ["/sign-in", "Clerk SignIn", "Clerk hosted UI — zero custom code needed"],
  ];
  return (
    <div>
      <DataTable headers={["Route", "Component", "Data Source"]} rows={pages} color={C.amber} />
    </div>
  );
}

function P4Libs() {
  return (
    <div>
      <CodeBlock label="INSTALL DASHBOARD DEPENDENCIES" color={C.amber}>{`cd apps/web
pnpm add recharts          # Charts (LineChart, BarChart, PieChart)
pnpm add @shadcn/ui        # Component library (shadcn)
pnpm add lucide-react      # Icon set
pnpm add date-fns          # Date formatting
pnpm add axios             # HTTP client`}</CodeBlock>
    </div>
  );
}

function P4E2E() {
  const steps = [
    "Open http://localhost:3000",
    "Click Sign Up — register with your email",
    "Create an Organisation in Clerk (this = your Tenant)",
    "Redirected to /dashboard — empty state shown correctly",
    "Navigate to /connectors/add",
    "Enter your real Azure Subscription ID",
    "Click \"Connect\" — API calls DefaultAzureCredential, verifies access",
    "Connector saved with status \"active\" — success message shown",
    "Click \"Sync Now\" — triggers ingestAzureCosts Trigger.dev job",
    "Job runs — pulls real Azure cost data — writes to TimescaleDB",
    "Navigate to /dashboard",
    "★ REAL AZURE COSTS VISIBLE IN CHARTS ★",
    "Refresh page — data loads from Redis cache in <50ms",
    "Open second browser tab — log in as a different user/org",
    "Their dashboard shows NO data from step 12 — tenant isolation works",
  ];
  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, fontFamily: "Space Mono, monospace", marginBottom: 16, lineHeight: 1.8 }}>
        Walk through this exact sequence manually before declaring the prototype complete.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            display: "flex", gap: 12, padding: "10px 14px",
            background: s.includes("★") ? `${C.amber}15` : C.card,
            border: `1px solid ${s.includes("★") ? C.amber + "60" : C.border}`,
            borderRadius: 7, alignItems: "flex-start",
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700, fontFamily: "Space Mono, monospace",
              color: s.includes("★") ? C.amber : C.muted, minWidth: 24, flexShrink: 0,
            }}>{String(i + 1).padStart(2, "0")}.</span>
            <span style={{
              fontSize: 11, color: s.includes("★") ? C.amber : C.text,
              fontFamily: "Space Mono, monospace", lineHeight: 1.6,
              fontWeight: s.includes("★") ? 700 : 400,
            }}>{s}</span>
          </div>
        ))}
      </div>
      <Alert type="success">
        <strong style={{ color: C.green }}>★ PROTOTYPE COMPLETE WHEN —</strong><br/>
        Step 12 shows real numbers from your Azure subscription.<br/>
        Step 15 confirms tenant isolation — no data leakage between tenants.<br/>
        Full stack running: Next.js + NestJS + PostgreSQL + Redis + Trigger.dev + Azure SDK.<br/>
        All data is real — zero mocks, zero hardcoded values, zero static JSON.
      </Alert>
    </div>
  );
}

/* ─── TAB CONTENT MAP ────────────────────────────────────────────────────── */
const TAB_CONTENT = {
  p0: { accounts: P0Accounts, runtimes: P0Runtimes, vscode: P0VSCode, docker: P0Docker, azure: P0Azure, git: P0Git, verify: P0Verify },
  p1: { structure: P1Structure, scaffold: P1Scaffold, prisma: P1Prisma, envfiles: P1EnvFiles },
  p2: { clerk: P2Clerk, guards: P2Guards, connector: P2Connector, complete: P2Complete },
  p3: { timescale: P3Timescale, jobs: P3Jobs, api: P3API, cache: P3Cache },
  p4: { trpc: P4tRPC, pages: P4Pages, libs: P4Libs, e2e: P4E2E },
};

/* ─── ROOT APP ───────────────────────────────────────────────────────────── */
export default function App() {
  const [activePhase, setActivePhase] = useState("p0");
  const [activeTab, setActiveTab] = useState("accounts");
  const phase = PHASE_CONFIG[activePhase];
  const tabs = SUB_NAV[activePhase];
  const validTab = tabs.find(t => t.id === activeTab) ? activeTab : tabs[0].id;
  const Content = TAB_CONTENT[activePhase]?.[validTab];

  const switchPhase = (id) => {
    setActivePhase(id);
    setActiveTab(SUB_NAV[id][0].id);
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      {/* HORIZONTAL TOP BAR */}
      <div style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", padding: "0 20px", height: 48, gap: 0, flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 24, flexShrink: 0 }}>
          <div style={{
            width: 30, height: 30, background: C.amber + "20", border: `1px solid ${C.amber}50`,
            borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: C.amber,
          }}>◆</div>
          <div>
            <div style={{ fontSize: 13, fontFamily: "Bebas Neue, sans-serif", color: C.text, letterSpacing: "0.08em" }}>CloudGuard 360</div>
            <div style={{ fontSize: 8, color: C.muted, fontFamily: "Space Mono, monospace", letterSpacing: "0.12em" }}>PROTOTYPE ROADMAP</div>
          </div>
        </div>

        {/* Phase tabs in horizontal bar */}
        <div style={{ display: "flex", gap: 2, flex: 1, overflow: "hidden" }}>
          {VERTICAL_NAV.map(n => {
            const pc = PHASE_CONFIG[n.id];
            return (
              <button key={n.id} onClick={() => switchPhase(n.id)} style={{
                padding: "0 16px", height: 48, border: "none", cursor: "pointer",
                background: activePhase === n.id ? pc.color + "18" : "transparent",
                color: activePhase === n.id ? pc.color : C.muted,
                borderBottom: activePhase === n.id ? `2px solid ${pc.color}` : "2px solid transparent",
                fontFamily: "Space Mono, monospace", fontSize: 11, fontWeight: 700,
                whiteSpace: "nowrap", transition: "all 0.14s",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
              }}>
                <span style={{ fontSize: 9, letterSpacing: "0.1em" }}>{pc.label}</span>
                <span style={{ fontSize: 9, color: activePhase === n.id ? pc.color + "80" : C.dim, fontWeight: 400 }}>{pc.days}</span>
              </button>
            );
          })}
        </div>

        {/* Status pill */}
        <div style={{
          marginLeft: 16, padding: "3px 10px",
          background: C.green + "20", border: `1px solid ${C.green}40`,
          borderRadius: 3, fontSize: 9, color: C.green, fontFamily: "Space Mono, monospace",
          fontWeight: 700, letterSpacing: "0.08em", flexShrink: 0,
        }}>~26 DAYS TO PROTOTYPE</div>
      </div>

      {/* BODY — vertical nav + content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* VERTICAL LEFT NAV */}
        <div style={{
          width: 72, background: C.surface, borderRight: `1px solid ${C.border}`,
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "16px 0", gap: 4, flexShrink: 0,
        }}>
          {VERTICAL_NAV.map(n => {
            const pc = PHASE_CONFIG[n.id];
            return (
              <button key={n.id} onClick={() => switchPhase(n.id)} title={n.label} style={{
                width: 52, height: 52, border: "none", cursor: "pointer", borderRadius: 8,
                background: activePhase === n.id ? pc.color + "22" : "transparent",
                border: `1px solid ${activePhase === n.id ? pc.color + "60" : "transparent"}`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                transition: "all 0.14s",
              }}>
                <span style={{ fontSize: 18, color: activePhase === n.id ? pc.color : C.muted }}>{n.icon}</span>
                <span style={{ fontSize: 8, color: activePhase === n.id ? pc.color : C.muted, fontFamily: "Space Mono, monospace", letterSpacing: "0.06em" }}>
                  {n.id.toUpperCase()}
                </span>
              </button>
            );
          })}

          {/* Progress indicator */}
          <div style={{ flex: 1 }} />
          <div style={{ width: 40, display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
            {VERTICAL_NAV.map((n, i) => {
              const idx = VERTICAL_NAV.findIndex(x => x.id === activePhase);
              return (
                <div key={n.id} style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: i <= idx ? PHASE_CONFIG[n.id].color : C.border,
                  transition: "all 0.2s",
                }} />
              );
            })}
          </div>
          <div style={{ height: 16 }} />
        </div>

        {/* MAIN AREA */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Phase header + sub-tab nav */}
          <div style={{
            background: C.surface, borderBottom: `1px solid ${C.border}`,
            padding: "0 24px", flexShrink: 0,
          }}>
            {/* Phase title row */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 14, paddingBottom: 10 }}>
              <div>
                <div style={{ fontSize: 9, color: phase.color, fontFamily: "Space Mono, monospace", letterSpacing: "0.14em", fontWeight: 700, marginBottom: 2 }}>
                  {activePhase.toUpperCase()} · {phase.days}
                </div>
                <div style={{ fontSize: 22, fontFamily: "Bebas Neue, sans-serif", color: C.text, letterSpacing: "0.06em" }}>
                  {phase.label}
                </div>
              </div>
            </div>

            {/* Sub-tabs */}
            <div style={{ display: "flex", gap: 2 }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  padding: "7px 14px", border: "none", cursor: "pointer", borderRadius: "5px 5px 0 0",
                  background: validTab === t.id ? phase.color + "20" : "transparent",
                  color: validTab === t.id ? phase.color : C.muted,
                  borderBottom: validTab === t.id ? `2px solid ${phase.color}` : "2px solid transparent",
                  fontFamily: "Space Mono, monospace", fontSize: 11, fontWeight: 700,
                  transition: "all 0.12s", letterSpacing: "0.04em",
                }}>{t.label}</button>
              ))}
            </div>
          </div>

          {/* CONTENT */}
          <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>
            {Content && <Content />}
          </div>
        </div>
      </div>
    </div>
  );
}
