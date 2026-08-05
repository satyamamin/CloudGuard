import { auth } from "@clerk/nextjs/server";
import { getInstancePairing } from "@/lib/clerk-org-metadata";
import { backendClientFor } from "@/lib/backend-client";
import { DailyCostChart } from "@/components/dashboard/daily-cost-chart";
import { ErrorState } from "@/components/dashboard/error-state";

interface DailyCostsPageProps {
  searchParams: { subscriptionId?: string; days?: string };
}

export default async function DailyCostsPage({ searchParams }: DailyCostsPageProps) {
  const { orgId } = auth();
  if (!orgId) return null; // middleware already redirects unauthenticated requests

  const pairing = await getInstancePairing(orgId);
  if (!pairing) return null; // middleware/layout already redirect unpaired orgs

  try {
    const data = await backendClientFor(pairing).dailyCosts({
      subscriptionId: searchParams.subscriptionId,
      days: searchParams.days ? Number(searchParams.days) : undefined,
    });

    return (
      <div>
        <h1 className="text-xl font-semibold">Daily costs</h1>
        <p className="mb-6 mt-1 text-sm text-[var(--text-secondary)]">
          {data.from} – {data.to}
        </p>
        <DailyCostChart days={data.days} currency={data.currency} />
      </div>
    );
  } catch (err) {
    return <ErrorState message={err instanceof Error ? err.message : "Could not load daily costs."} />;
  }
}
