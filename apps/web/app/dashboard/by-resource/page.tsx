import { auth } from "@clerk/nextjs/server";
import { getInstancePairing } from "@/lib/clerk-org-metadata";
import { backendClientFor } from "@/lib/backend-client";
import { CostByResourceChart } from "@/components/dashboard/cost-by-resource-chart";
import { ErrorState } from "@/components/dashboard/error-state";

interface CostByResourcePageProps {
  searchParams: { subscriptionId?: string; days?: string };
}

export default async function CostByResourcePage({ searchParams }: CostByResourcePageProps) {
  const { orgId } = auth();
  if (!orgId) return null;

  const pairing = await getInstancePairing(orgId);
  if (!pairing) return null;

  try {
    const data = await backendClientFor(pairing).costByResource({
      subscriptionId: searchParams.subscriptionId,
      days: searchParams.days ? Number(searchParams.days) : undefined,
    });

    return (
      <div>
        <h1 className="text-xl font-semibold">Cost by resource</h1>
        <p className="mb-6 mt-1 text-sm text-[var(--text-secondary)]">
          {data.from} – {data.to}
        </p>
        <CostByResourceChart resources={data.resources} currency={data.currency} />
      </div>
    );
  } catch (err) {
    return <ErrorState message={err instanceof Error ? err.message : "Could not load cost by resource."} />;
  }
}
