import { auth } from "@clerk/nextjs/server";
import { getInstancePairing } from "@/lib/clerk-org-metadata";
import { backendClientFor } from "@/lib/backend-client";
import { DailyCostChart } from "@/components/dashboard/daily-cost-chart";
import { ErrorState } from "@/components/dashboard/error-state";

interface DailyCostsPageProps {
  searchParams: Promise<{ subscriptionId?: string; days?: string }>;
}

export default async function DailyCostsPage({ searchParams }: DailyCostsPageProps) {
  const { orgId } = await auth();
  if (!orgId) return null; // proxy already redirects unauthenticated requests

  const pairing = await getInstancePairing(orgId);
  if (!pairing) return null; // proxy/layout already redirect unpaired orgs

  try {
    const resolvedSearchParams = await searchParams;
    const data = await backendClientFor(pairing).dailyCosts({
      subscriptionId: resolvedSearchParams.subscriptionId,
      days: resolvedSearchParams.days ? Number(resolvedSearchParams.days) : undefined,
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
