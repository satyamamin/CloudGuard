import { auth } from "@clerk/nextjs/server";
import { getInstancePairing } from "@/lib/clerk-org-metadata";
import { backendClientFor } from "@/lib/backend-client";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { AccumulatedCostChart } from "@/components/dashboard/accumulated-cost-chart";
import { ErrorState } from "@/components/dashboard/error-state";
import { formatCurrency } from "@/lib/format";

interface OverviewPageProps {
  searchParams: { subscriptionId?: string; days?: string };
}

// Fetches one double-length daily-costs window (days*2) instead of a
// separate accumulated-costs call: splitting it in half gives both the
// current-vs-prior-period delta AND the data to derive the accumulated hero
// chart client-side — one Azure call doing the work of two.
export default async function DashboardOverviewPage({ searchParams }: OverviewPageProps) {
  const { orgId } = auth();
  if (!orgId) return null;

  const pairing = await getInstancePairing(orgId);
  if (!pairing) return null;

  const days = searchParams.days ? Number(searchParams.days) : 30;
  const subscriptionId = searchParams.subscriptionId;
  const client = backendClientFor(pairing);

  try {
    const [dailyDouble, byService, byResource] = await Promise.all([
      client.dailyCosts({ subscriptionId, days: days * 2 }),
      client.costByService({ subscriptionId, days }),
      client.costByResource({ subscriptionId, days }),
    ]);

    const allDays = dailyDouble.days;
    const splitAt = Math.max(0, allDays.length - days);
    const previousDays = allDays.slice(0, splitAt);
    const currentDays = allDays.slice(splitAt);

    const currentTotal = currentDays.reduce((sum, d) => sum + d.cost, 0);
    const previousTotal = previousDays.reduce((sum, d) => sum + d.cost, 0);
    const deltaPct = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : null;

    let running = 0;
    const accumulatedDays = currentDays.map((d) => {
      running += d.cost;
      return { date: d.date, cumulativeCost: running };
    });

    const topService = byService.services[0];
    const topResource = byResource.resources[0];

    return (
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="mb-6 mt-1 text-sm text-[var(--text-secondary)]">
          {currentDays[0]?.date} – {dailyDouble.to}
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiTile
            label="Total spend this period"
            value={formatCurrency(currentTotal, dailyDouble.currency)}
            delta={deltaPct === null ? null : { pct: deltaPct, goodDirection: "down" }}
          />
          <KpiTile
            label="Top service"
            value={topService ? formatCurrency(topService.cost, byService.currency) : "—"}
            subtitle={topService?.serviceName}
          />
          <KpiTile
            label="Top resource"
            value={topResource ? formatCurrency(topResource.cost, byResource.currency) : "—"}
            subtitle={topResource?.resourceName}
          />
        </div>

        <h2 className="mb-2 mt-8 text-sm font-medium text-[var(--text-secondary)]">Accumulated cost</h2>
        <AccumulatedCostChart days={accumulatedDays} currency={dailyDouble.currency} />
      </div>
    );
  } catch (err) {
    return <ErrorState message={err instanceof Error ? err.message : "Could not load the overview."} />;
  }
}
