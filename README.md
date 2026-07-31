# CloudGuard 360

Azure cost management that deploys directly into a customer's own Azure tenant — CloudGuard hosts only the frontend; there is no CloudGuard-side backend or database.

See [`docs/connect-azure.md`](docs/connect-azure.md) for the full architecture and endpoint contract, and [`CLAUDE.md`](CLAUDE.md) for detailed guidance on working in this repo.

## Architecture

- A customer provisions a backend + Postgres **inside their own Azure tenant** via a "Deploy to Azure" button (ARM/Bicep). CloudGuard centrally hosts only the Next.js frontend.
- The deployed backend authenticates to Azure Cost Management via a **system-assigned Managed Identity** — no client secret is ever entered, stored, or transmitted.
- Isolation between customers is **physical** (one Postgres instance per deployment), not row-level.
- The frontend pairs with a customer's deployed instance via a `Backend URL` + `API key`, stored in **Clerk private organization metadata**.

## Repo structure

```
apps/api/         NestJS backend — the code deployed into the customer's tenant
apps/web/         Next.js frontend — the only thing CloudGuard hosts centrally
packages/shared/  Zod schemas + types shared by both apps
infra/bicep/       The "Deploy to Azure" template
docs/              connect-azure.md (source of truth) + initial-vision-archive.md (historical only)
```

## Getting started

```bash
npm install
npm run build:shared   # build packages/shared first — apps/api and apps/web depend on it
```

### `apps/api` (NestJS backend)

```bash
docker compose -f docker-compose.dev.yml up -d      # local Postgres
cp apps/api/.env.example apps/api/.env               # see file for AZURE_AUTH_MODE, API_KEY, etc.
npm run prisma:generate -w apps/api
npm run prisma:migrate:dev -w apps/api
npm run dev:api                                       # http://localhost:3001
```

For real Azure calls locally, set `AZURE_AUTH_MODE=cli` in `apps/api/.env` and run `az login` first.

### `apps/web` (Next.js frontend)

```bash
cp apps/web/.env.local.example apps/web/.env.local    # needs Clerk keys — see file
npm run dev -w apps/web                                # http://localhost:3000
```

Requires a Clerk application with **Organizations enabled** (Membership required) — see the Clerk setup note in [`CLAUDE.md`](CLAUDE.md) if `auth().orgId` comes back empty for a user with a real org membership.

### `infra/bicep`

```bash
az bicep build --file infra/bicep/main.bicep --outfile infra/bicep/main.json
az deployment group validate --resource-group <test-rg> --template-file infra/bicep/main.json
```

## Commands

| Command | Description |
|---|---|
| `npm run build` | Build `packages/shared` → `apps/api` → `apps/web`, in order |
| `npm run dev:api` | `apps/api` in watch mode |
| `npm run dev:web` | `apps/web` dev server |
| `npm run lint -w apps/web` | Lint the frontend |

No test runner is configured in this repo yet.
