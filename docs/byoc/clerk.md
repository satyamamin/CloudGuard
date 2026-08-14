# Clerk setup (BYOC)

Reference doc for standing up Clerk for `apps/web` and for manually looking
up a specific customer's paired backend during support/debugging. Verified
against the actual code in this repo, not generic Clerk docs — re-check
against source if this drifts, especially after any Clerk SDK version bump.

## Minimum setup

1. Create a Clerk application (or reuse an existing one) — this app only
   needs the two standard keys.
2. Set env vars in `apps/web/.env.local` (see
   `apps/web/.env.local.example`):
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
   CLERK_SECRET_KEY=
   ```
3. Enable **Organizations**, with **"Membership required"** (Clerk
   Dashboard → Organizations settings). Every signed-in user needs an
   active org — `apps/web/proxy.ts` and every `app/api/instance/*` route
   read `(await auth()).orgId`, and there's no code path that works without one.
4. Customize the session token to actually include org claims (Dashboard →
   **Configure → Sessions → Customize session token**):
   ```json
   { "org_id": "{{org.id}}", "org_slug": "{{org.slug}}", "org_role": "{{org.role}}" }
   ```
   A fresh Clerk application's session token does **not** include these by
   default — without this step, `orgId` is `undefined` even for a
   user with a real, confirmed org membership. Existing sessions pick the
   claim up automatically (tokens refresh ~every 60s); no sign-out/in
   needed once it's added.
5. That's it to run locally — `apps/web/app/layout.tsx` already renders
   `OrganizationSwitcher` + `UserButton` for creating/switching orgs during
   dev, and `npm run dev -w apps/web` works from there.

## Finding a customer's paired backend URL + API key

Terminology check first: there's no "database URL" stored in Clerk at all,
and there never will be — per this project's core architecture (see root
`CLAUDE.md`), FinOps Lab has no backend or database of its own, and the
customer's Postgres connection string lives only inside their own deployed
Container App, never leaving their Azure tenant. What *is* paired in Clerk
is the customer's deployed BYOC **backend URL** + **API key** — the two
values shown once as Bicep deployment outputs and pasted into the pairing
form on `/connect-azure`.

They're stored together as one object under Clerk **private** organization
metadata, nested — not as flat top-level fields:

```
privateMetadata.instancePairing = { backendUrl: string, apiKey: string }
```

(schema: `packages/shared/src/schemas/pairing.ts`'s `instancePairingSchema`;
read/write path: `apps/web/lib/clerk-org-metadata.ts`, marked `server-only`
so it can never reach a client component by accident.)

### Option 1 — Clerk Dashboard (manual, one-off lookup)

Organizations → pick the customer's org → the metadata section on the
org's detail page shows the `privateMetadata` JSON. Look for
`instancePairing.backendUrl` and `instancePairing.apiKey` — nested one
level down, not top-level keys.

### Option 2 — Programmatically (Backend API)

This repo is on `@clerk/nextjs` v7 (not `@clerk/express`), where
`clerkClient()` returns a `Promise`:

```ts
import { clerkClient } from "@clerk/nextjs/server";

const client = await clerkClient();
const org = await client.organizations.getOrganization({ organizationId: "org_xxxxx" });
const { backendUrl, apiKey } = org.privateMetadata.instancePairing as { backendUrl: string; apiKey: string };
```

This is exactly what `getInstancePairing()` in
`apps/web/lib/clerk-org-metadata.ts` already does server-side (plus Zod
validation via `instancePairingSchema`) — reuse that function directly
rather than re-implementing this lookup, if any admin/debug tooling ever
gets built inside `apps/web`.

`privateMetadata` (not `publicMetadata`) is deliberate and already correct
in the shipped code — `apiKey` is a live credential, and `publicMetadata`
is readable client-side via the Clerk React SDK, which would leak it
straight to the browser. `privateMetadata` is only ever reachable
server-side via the Backend API, which is why every read of it in this
repo goes through the `server-only`-marked file above.

### Known gap

There's no admin tool in this app to look up an org by customer name →
`orgId` — the only ways today are the Clerk Dashboard's organization list
(searchable by name) or the snippet above once you already have the
`orgId`. Not built because v1 has no internal admin surface at all yet;
worth revisiting if support/debugging volume grows.

### Known gap: no UI to change an existing pairing

`apps/web/app/connect-azure/page.tsx` only renders `PairingForm` when
`getMaskedInstancePairing(orgId)` returns null (`{!pairing && ...}`) — once
an org is paired, there's no button anywhere in the app to change the
Backend URL/API key. `POST /api/instance` (`app/api/instance/route.ts`)
would happily overwrite the pairing if called, but nothing in the UI ever
calls it again after the first pairing. Two workarounds, depending on why
you need to change it:
- **One-off/support**: edit `privateMetadata.instancePairing` directly in
  the Clerk Dashboard (Option 1 above).
- **Local dev, wanting to point at `localhost:3001` instead of an
  already-paired deployed instance**: use a second, dedicated Clerk
  application instead of fighting this gap — a fresh org there has no
  pairing to conflict with, so `PairingForm` shows normally. This is
  exactly what `dev-test/set-mode.ps1 -Mode local|azure` automates (see
  root `CLAUDE.md`), switching `apps/web/.env.local`'s Clerk keys between
  a local-only app and the one already paired with the deployed instance.
  Set up the second app with the same "Minimum setup" steps above, but put
  its keys in `apps/web/.env.dev-local` (the deployed-instance app's keys
  go in `.env.dev-azure`) — **not** `.env.local` directly. `set-mode.ps1`
  overwrites `.env.local` from whichever of those two files you select, so
  keys added only to `.env.local` get silently clobbered on the next mode
  switch.
