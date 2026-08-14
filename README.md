# FinOps Lab

Azure cost management that deploys directly into a customer's own Azure tenant — FinOps Lab hosts only the frontend; there is no FinOps Lab-side backend or database.

See [`docs/byoc/connect-azure.md`](docs/byoc/connect-azure.md) for the full architecture and endpoint contract, and [`CLAUDE.md`](CLAUDE.md) for detailed guidance on working in this repo.

## Architecture

- A customer provisions a backend + Postgres **inside their own Azure tenant** via a "Deploy to Azure" button (ARM/Bicep). FinOps Lab centrally hosts only the Next.js frontend.
- The deployed backend authenticates to Azure Cost Management via a **system-assigned Managed Identity** — no client secret is ever entered, stored, or transmitted.
- Isolation between customers is **physical** (one Postgres instance per deployment), not row-level.
- The frontend pairs with a customer's deployed instance via a `Backend URL` + `API key`, stored in **Clerk private organization metadata**.

## Repo structure

```
apps/api-byoc/         NestJS backend — the code deployed into the customer's tenant
apps/web/         Next.js frontend — the only thing FinOps Lab hosts centrally
packages/shared/  Zod schemas + types shared by both apps
infra/bicep/       The "Deploy to Azure" template
docs/             architecture.md + other shared docs at root; docs/byoc/connect-azure.md (source of truth); docs/saas/plan/ (deferred tier)
```

## Getting started

```bash
npm install
npm run build:shared   # build packages/shared first — apps/api-byoc and apps/web depend on it
```

### `apps/api-byoc` (NestJS backend)

```bash
docker compose -f docker-compose.dev.yml up -d      # local Postgres
cp apps/api-byoc/.env.example apps/api-byoc/.env               # see file for AZURE_AUTH_MODE, API_KEY, etc.
npm run prisma:generate -w apps/api-byoc
npm run prisma:migrate:dev -w apps/api-byoc
npm run dev:api                                       # http://localhost:3001
```

For real Azure calls locally, set `AZURE_AUTH_MODE=cli` in `apps/api-byoc/.env` and run `az login` first.

### `apps/web` (Next.js frontend)

```bash
cp apps/web/.env.local.example apps/web/.env.local    # needs Clerk keys — see file
npm run dev -w apps/web                                # http://localhost:3000
```

Requires a Clerk application with **Organizations enabled** (Membership required) — see [`docs/byoc/clerk.md`](docs/byoc/clerk.md) for full setup steps, or the Clerk setup note in [`CLAUDE.md`](CLAUDE.md) if `(await auth()).orgId` comes back empty for a user with a real org membership.

### `infra/bicep`

```bash
az bicep build --file infra/bicep/main.bicep --outfile infra/bicep/main.json
az deployment group validate --resource-group <test-rg> --template-file infra/bicep/main.json
```

## Restarting dev (Connect Azure testing)

One-time setup (`npm install`, `.env` files, Prisma migrate) only needs to happen once. Each time you come back to test the Connect Azure flow — against local Postgres or a real Azure Flexible Server, whichever `apps/api-byoc/.env`'s `DATABASE_URL` currently points at — run these in order:

1. **Ensure Azure CLI has a valid session**:
   ```powershell
   .\dev-test\ensure-az-login.ps1
   ```
   Logs in non-interactively via a Service Principal (see `dev-test/.env.example`) only if the current session's token has actually expired, then selects the target subscription. Avoids the interactive `az login` re-auth otherwise forced every few hours by Conditional Access sign-in-frequency policies on personal accounts.

2. **If `DATABASE_URL` points at `localhost`, make sure Docker Desktop is running**, then start local Postgres (safe to re-run, no-op if already up). Skip this step entirely if `DATABASE_URL` points at a real Azure Flexible Server instead:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

3. **Start `apps/api-byoc`** (new terminal, leave running):
   ```bash
   npm run dev:api
   ```
   Wait for `Nest application successfully started`.

4. **Start `apps/web`** (separate new terminal, leave running):
   ```bash
   npm run dev:web
   ```
   Wait for `Ready in ...` from Next.js.

5. **Start Prisma Studio** (separate new terminal, leave running) if you want to browse whichever database `DATABASE_URL` currently points at:
   ```bash
   cd apps/api-byoc && npx prisma studio --port 5555
   ```
   Opens at `http://localhost:5555`. Lightweight — fine to leave running alongside the two dev servers above.

6. **Sanity-check the backend before opening the browser**:
   ```bash
   curl -H "Authorization: Bearer <your-API_KEY>" http://localhost:3001/health
   ```
   Should return `{"status":"ok",...}`. If `/health` works but `/subscriptions` or `/sync` later fail with a 500, it's almost always the Azure CLI token again (step 1).

7. Open the browser to `http://localhost:3000/connect-azure` and complete pairing + subscription select + sync. Once synced, cost data is viewable at `http://localhost:3000/dashboard`.

Steps 1–7 above are automated by a single script:
```powershell
.\dev-test\test-dev.ps1
```
Idempotent — skips Docker/`apps/api-byoc`/`apps/web`/Prisma Studio if already running instead of starting duplicates, and reuses an already-open Chrome window rather than spawning a new one.

Two companion scripts:
```powershell
.\dev-test\stop-dev.ps1              # stops apps/api-byoc, apps/web, Prisma Studio, and local Postgres
.\dev-test\set-mode.ps1 -Mode local  # or -Mode azure — swaps apps/api-byoc/.env + apps/web/.env.local
```
`set-mode.ps1` switches between two complete profiles in one command: `local` (local Postgres, mock cost data, a dedicated local-only Clerk app) and `azure` (real Azure Postgres + Cost Management, the Clerk app paired with the deployed Container App). It auto-restarts anything already running unless `-NoRestart` is passed. Both modes exist because local is fast/free but structurally can't verify Managed Identity or real throttling, while azure can — and both scripts exist because hand-editing two separate `.env` files in sync, then remembering to restart everything, is exactly the kind of thing that goes silently wrong (see `CLAUDE.md` for the full rationale).

## Commands

| Command | Description |
|---|---|
| `npm run build` | Build `packages/shared` → `apps/api-byoc` → `apps/web`, in order |
| `npm run dev:api` | `apps/api-byoc` in watch mode |
| `npm run dev:web` | `apps/web` dev server |
| `npm run lint -w apps/web` | Lint the frontend |

No test runner is configured in this repo yet.
