# Cost dashboard — frontend implementation

Audience: an outside reviewer assessing the `apps/web/app/dashboard` implementation
(as opposed to `docs/byoc/connect-azure.md`, which documents the onboarding flow this
dashboard sits downstream of).

## 1. What this is

A cost-visibility dashboard added to `apps/web` (the only thing FinOps Lab hosts
centrally), rendering the four Cost Management views already exposed by a
customer's self-hosted `apps/api-byoc` instance:

- **Overview** — a glanceable summary: spend this period vs. prior period, top
  service, top resource, accumulated-cost trend.
- **Daily costs** — cost per day, chart or table.
- **Cost by service** — cost grouped by Azure service (e.g. Storage, Compute),
  sorted descending.
- **Cost by resource** — cost grouped by individual Azure resource; can run into
  hundreds of rows for a real subscription.

It lives at `/dashboard` and `/dashboard/{daily,by-service,by-resource}`, reached
after a customer completes the `/connect-azure` pairing + sync flow — it is the
ongoing product surface, `/connect-azure` is one-time setup.

## 2. Product decisions made before writing code

Three decisions were locked in up front (via a scoped planning pass) specifically
to avoid rework:

| Decision | Choice | Why |
|---|---|---|
| Route | New dedicated `/dashboard`, not an extension of `/connect-azure` | Onboarding and the ongoing product surface are different concerns; keeping them separate keeps the onboarding stepper simple and lets the dashboard grow independently. |
| Charting | [Recharts](https://recharts.org/) | shadcn/ui's own chart components are built on it, so it fits the `Card`/`Button`/`Input` primitives already in `apps/web/components/ui/` without pulling in a second design language. |
| Audience | Both a glanceable summary (Overview) *and* a detailed drill-down per view | Matches how SaaS cost tools are actually used — a quick "am I on budget" glance and a "why" investigation are different sessions with different needs; picking only one would have under-served one of them. |

## 3. Architecture

### 3.1 Data flow — the same two-layer proxy pattern as onboarding

The browser **never** talks to a customer's deployed backend directly, and never
sees the customer's API key. Every cost view goes through two layers, matching
the pattern already established for onboarding (`app/api/instance/subscriptions/route.ts`):

```
Browser (Server Component)
   │
   ▼
apps/web/app/api/instance/costs/{daily,accumulated,by-service,by-resource}/route.ts
   - auth().orgId check (Clerk)
   - look up the org's paired instance (Clerk private org metadata)
   - forward subscriptionId / days query params
   │
   ▼
apps/web/lib/backend-client.ts  (server-only, Zod-validates the response)
   │
   ▼  HTTPS + API key header
Customer's deployed apps/api-byoc  →  Azure Cost Management API
```

Each of the four `costs/*/route.ts` handlers is ~15 lines and does exactly four
things: confirm the signed-in user has an active Clerk organization, look up that
org's backend pairing, forward the request, return JSON. No business logic lives
in the route handlers — that's all in `apps/api-byoc`.

### 3.2 Page structure

```
app/dashboard/
  layout.tsx        Shared chrome: nav, subscription switcher, period selector.
                     Also the auth/pairing gate — redirects to /connect-azure if
                     no active org or no paired instance.
  page.tsx           Overview
  daily/page.tsx      Daily costs detail
  by-service/page.tsx Cost by service detail
  by-resource/page.tsx Cost by resource detail
  {each}/loading.tsx  Route-segment loading skeleton (Next.js convention —
                       automatic, no manual isLoading state)
```

All four pages are **React Server Components** — they fetch data server-side on
each navigation (via the proxy layer above) and render server-rendered HTML. No
client-side data-fetching library (no SWR/React Query) — Next.js's own
server-component + route-segment-loading model covers it, since there's no need
for client-side caching or polling here.

### 3.3 State management: the URL is the source of truth

The subscription filter (`?subscriptionId=`) and period filter (`?days=`) are
**URL search params**, not React state. `components/dashboard/subscription-switcher.tsx`
and `period-selector.tsx` are the only client components involved, and all they do
on change is `router.push()` a new query string — the actual data-fetching happens
server-side on the resulting page render.

This was a deliberate choice over local component state:

- **Bookmarkable / shareable** — a link to "last 90 days, subscription X" is a
  real URL a teammate can open, not app-internal state.
- **Server-renderable** — no client-side fetch waterfall after first paint; the
  server component reads `searchParams` directly.
- **Consistent across pages** — navigating Overview → Daily costs preserves the
  selected subscription/period automatically, because the values live in the URL,
  not in a component that unmounts on navigation.

### 3.4 One API call doing two jobs (Overview page)

`app/dashboard/page.tsx` avoids what would otherwise be 3 separate Azure-backed
calls for the Overview page's data needs:

- It requests `dailyCosts({ days: days * 2 })` **once** — e.g. 60 days of daily
  costs when the period selector is set to 30d.
- It splits the returned array in half: the second half is the current period,
  the first half is the prior period of equal length.
- The prior-period delta (the `-5.7% vs prior period` badge on the "Total spend"
  KPI tile) is computed from that split, client-side (well, server-side — this is
  in the Server Component), no second network call.
- The accumulated/cumulative series feeding the hero chart is also derived from
  the *same* response (a running sum over the current-period half) instead of
  calling the separate `/costs/accumulated` endpoint, which would just be
  redundant given the daily data is already in hand.

`costByService`/`costByResource` (current period only) are still fetched
separately, since Overview needs their top entries for the "Top service"/"Top
resource" tiles and there's no cheaper way to derive that from daily data.

### 3.5 Subscription scoping

`SubscriptionSwitcher` intentionally filters the full Azure subscription list
down to only the subscriptions selected during onboarding
(`Instance.selectedSubscriptionIds`) — `apps/api-byoc`'s `/costs/*` endpoints have no
synced context for a subscription that was never selected, so offering it in the
dropdown would just produce empty/error states. If a customer has more Azure
subscriptions than appear here, the fix is re-running subscription selection in
`/connect-azure`, not a dashboard change.

## 4. Visual design

### 4.1 Design tokens

No manual theme toggle exists in `apps/web` — dark mode follows OS preference via
`@media (prefers-color-scheme: dark)`. Chart-specific tokens (surfaces, text,
gridlines, the single sequential blue used for cost magnitude, delta
good/bad colors, status colors) are CSS custom properties scoped to a
`.dashboard-root` class in `globals.css`, with light values as the default block
and a dark override block. This keeps chart color decisions in one place rather
than scattered across component files, and keeps them separate from the rest of
the app's (currently token-less) Tailwind config.

### 4.2 Chart-type-per-question, not one chart type everywhere

Each view uses the chart type that matches what the data is actually answering,
rather than defaulting to "a bar chart" or "a line chart" everywhere:

| View | Chart | Why this type |
|---|---|---|
| Daily costs | Area chart | Trend over time — the shape of change matters, not just endpoints. |
| Accumulated cost | Area chart (cumulative) | Same reasoning, on a running total. |
| Cost by service | Horizontal bar, single hue | Magnitude comparison across a handful of categories — one sequential blue, not one color per bar, because color-per-category would wrongly imply *identity* matters when only *size* does. |
| Cost by resource | Top-10 horizontal bar + full table below | A real subscription can have 100+ resources — past roughly 7 categories a chart stops being legible, so the chart shows a top-10 glance and the full breakdown is a sortable table, with a "Show all N" toggle. |

Every chart also has a **table view fallback** (Daily costs and Cost by service
have a "View as table" toggle; Cost by resource shows the table permanently
alongside the chart) — numbers that matter for a cost tool should always be
available in exact, copyable form, not locked inside an SVG.

### 4.3 KPI tiles

`components/dashboard/kpi-tile.tsx` implements one consistent "figure" pattern
used across the Overview page: label, big value, optional subtitle, optional
delta. The delta's color is **not** hardcoded red-for-up/green-for-down — each
tile declares its own `goodDirection` (cost metrics use `"down"`, i.e. a red
percentage for *rising* spend), so the same component would render correctly for
a hypothetical future metric where "up" is good.

## 5. Notable implementation details

- **Recharts v3 has a `Tooltip` typing trap.** The installed version
  (`recharts@^3.10.1`) has `TooltipContentProps<Value, Name>` as a
  *parameterizable* type in its `.d.ts` files, which looks like it supports
  `<Tooltip<number, string>>` generic JSX instantiation — it doesn't; the actual
  exported `Tooltip` function is not generic, and that syntax fails to compile
  ("Expected 0 type arguments, but got 2"). The working pattern used throughout
  `components/dashboard/*-chart.tsx`: pass `content` as a function
  (`content={(props: TooltipContentProps<number, string>) => <ChartTooltip {...props} currency={currency} />}`)
  rather than a JSX element — Recharts clones tooltip props at runtime in a way
  a pre-built JSX element can't be statically type-checked against — **and**
  give `ChartTooltip` itself the matching explicit
  `TooltipContentProps<number, string> & { currency: string }` prop type, not
  the unparameterized default. Both sides have to agree: `formatter` is a
  function-typed prop (contravariant), so spreading a
  `TooltipContentProps<number, string>` value into a component typed with the
  wider unparameterized `TooltipContentProps` fails to type-check under the
  Next.js 16 / TS toolchain this app now runs — an earlier version of this
  guidance recommended the unparameterized default on both sides, which relied
  on looser inference that no longer holds.
- **Route-segment `loading.tsx` gives automatic loading states.** No manual
  `isLoading` flags anywhere in the dashboard — Next.js's App Router shows each
  route's `loading.tsx` skeleton automatically while its Server Component's data
  fetch is in flight.
- **Errors surface as a real message, not a generic failure screen.** Every
  detail page wraps its fetch in try/catch and renders `<ErrorState>` with the
  actual thrown error message (which, notably, includes Azure Cost Management's
  own `429` rate-limit wording when that's the cause — see `apps/api-byoc`'s
  `CostManagementService` for the caching that mitigates this in practice).

## 6. Screenshots

Captured from a real paired instance during development (`sub-clarity-prod`, 30-day
period). Save the corresponding PNGs into `docs/screenshots/` under the filenames
below for these to render.

### Overview

![Overview page — three KPI tiles and the accumulated cost chart](./screenshots/dashboard-overview.png)

Three KPI tiles (Total spend this period with a delta vs. the prior period, Top
service, Top resource) above the accumulated-cost hero chart. The delta here reads
`-5.7% vs prior period` in green — cost went down, and since `goodDirection: "down"`
for this metric (§4.3), a decrease renders as good/green rather than defaulting to
"green = up."

### Daily costs

![Daily costs page — area chart of cost per day](./screenshots/dashboard-daily.png)

Area chart with the "View as table" toggle (§4.2) visible top-right; the y-axis uses
compact currency formatting (`formatCompactCurrency`) and the x-axis ticks are
`Jul 6`-style short dates (`formatDateLabel`), not raw ISO strings.

### Cost by service

![Cost by service page — horizontal bar chart, single hue](./screenshots/dashboard-by-service.png)

Horizontal bars in a single sequential blue (`var(--series-1)`), sorted descending,
one bar per Azure service — the "magnitude, not identity" color choice from §4.2 in
practice: no per-service color-coding, because the comparison being made is size,
not which service is which (the label already says that).

### Cost by resource

![Cost by resource page — top-10 bar chart plus full table](./screenshots/dashboard-by-resource.png)

Top-10 horizontal bar chart above the full table (124 resources in this capture),
with the "Show all 124" toggle. This is the view that motivated the chart+table
split described in §4.2 — a single chart with 124 bars would be unreadable.

### Subscription scoping in the switcher

![Subscription switcher dropdown showing only the two selected subscriptions](./screenshots/subscription-switcher.png)

The dropdown lists only subscriptions selected during onboarding
(`sub-clarity-prod`, `sub-clarity-dev`), even when more exist in the underlying
Azure tenant — the filtering behavior documented in §3.5, not a bug.

## 7. File map

```
apps/web/
  app/dashboard/
    layout.tsx                Shared chrome + auth/pairing gate
    page.tsx                  Overview
    loading.tsx
    daily/page.tsx             Daily costs detail
    daily/loading.tsx
    by-service/page.tsx        Cost by service detail
    by-service/loading.tsx
    by-resource/page.tsx       Cost by resource detail
    by-resource/loading.tsx
  app/api/instance/costs/
    daily/route.ts
    accumulated/route.ts
    by-service/route.ts
    by-resource/route.ts
  components/dashboard/
    dashboard-nav.tsx          Nav links, active-route highlighting
    subscription-switcher.tsx  ?subscriptionId= control
    period-selector.tsx        ?days= control (7d/30d/90d presets)
    daily-cost-chart.tsx       Area chart + table toggle
    accumulated-cost-chart.tsx Area chart (cumulative)
    cost-by-service-chart.tsx  Horizontal bar + table toggle
    cost-by-resource-chart.tsx Top-10 horizontal bar + full table
    kpi-tile.tsx                Label/value/subtitle/delta figure
    empty-state.tsx
    error-state.tsx
  lib/
    backend-client.ts          Extended with 4 cost methods (server-only)
    format.ts                  Currency/date formatting shared by all charts
  app/globals.css              .dashboard-root design tokens (light + dark)
```

## 8. Known gaps / not yet done

- Loading/empty/error states have been built (see §5) but not explicitly
  exercised end-to-end (e.g. deliberately triggering a `429` or pointing at a
  subscription with zero synced cost data) — the code paths exist, the scenarios
  haven't been walked through live.
- The Cost by resource table has a "show all" toggle but no client-side sorting,
  search, or pagination — fine at ~124 rows (the real data seen in testing), may
  need revisiting at much larger resource counts.
- No automated tests — this repo has no test runner configured anywhere yet
  (see `CLAUDE.md`), so all verification so far has been manual, against real
  Azure data, in a browser.
- `docs/byoc/connect-azure.md` (the source-of-truth onboarding doc) does not yet
  describe the dashboard in detail; this document is currently the primary
  reference for it.
