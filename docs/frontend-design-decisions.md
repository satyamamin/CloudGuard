# CloudGuard 360 — Frontend Design Decisions

> Running log of UI/UX decisions, competitive references, and rationale.
> Append new entries at the bottom.

---

## Entry 001 — Overall shell & information architecture
**Date:** 2026-08-06
**References:** Turbo360 (Kovai Ltd), Holori
**Status:** Decided

### Recommendation: Holori's shell, Turbo360's information architecture

Take Holori's **layout** and Turbo360's **structure**.

Note: both products are browser-based. Turbo360's screenshot merely lacks browser chrome — this is a choice between two UI *paradigms*, not between desktop app and web app.

#### Keep from Holori
The KPI stat-card row (Total cost / Avg daily / Assets / Forecast), the global filter + date-range bar with saved views, and the light theme.

The Capgemini deck explicitly recommended "ergonomic, intuitive, max 10 indicators" — that stat row *is* that recommendation.

#### Keep from Turbo360
The four-section split — **Overview / Analysis / Monitoring / Optimization**.

This maps directly to the three audiences the Emeis assessment named:

| Section | Audience |
|---|---|
| Overview | CxO |
| Analysis | Business Towers |
| Monitoring + Optimization | Operations |

One product, three depths.

#### Drop from Holori
The world map. It's multi-cloud vanity; CloudGuard 360 is Azure-only and buyers care about subscription / resource-group / tag breakdowns, not region pins.

#### Defer from Turbo360
The resource tree. It's the most expensive component to build well (lazy loading, selection state, deep links).

Replace it in v1 with a **subscription selector in the filter bar** — subscription discovery/selection already exists as an API endpoint.

### Why this fits current constraints
- The app deploys **into the customer's own Azure tenant**, so the user is already inside one Azure boundary — the hierarchy is shallower than Turbo360's multi-tenant tree needs to be. A filter bar covers it.
- At ~10–15 h/week of build capacity, Holori's shell is roughly a third of the frontend effort of Turbo360's.
- Graduate to a resource tree in v2 when customers with 20+ subscriptions ask for it.

### Open follow-up
Make **Optimization actionable, not just informational**. Turbo360 shows anomalies; Holori shows a savings toggle. The Emeis evidence says the client's remediation today is manual PowerShell. A checkbox list of orphan disks / public IPs with an "estimated monthly saving" column and an export-to-script button is a differentiator worth more than any layout choice.

---
