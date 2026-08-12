"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, TooltipContentProps, XAxis, YAxis } from "recharts";
import { ResourceCost } from "@finops-lab/shared";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { EmptyState } from "./empty-state";

interface CostByResourceChartProps {
  resources: ResourceCost[];
  currency: string;
}

const TOP_N = 10;

function ChartTooltip({ active, payload, currency }: TooltipContentProps & { currency: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as ResourceCost | undefined;
  if (!point) return null;
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--chart-surface)] px-3 py-2 shadow-sm">
      <p className="text-xs text-[var(--text-secondary)]">{point.resourceName}</p>
      <p className="text-sm font-semibold text-[var(--text-primary)]">{formatCurrency(point.cost, currency)}</p>
    </div>
  );
}

// >~7 categories is past the point a chart can carry alone (dataviz skill's
// series-count ladder) — a top-N glance chart plus the full table underneath,
// not a single chart trying to fit 100+ bars.
export function CostByResourceChart({ resources, currency }: CostByResourceChartProps) {
  const [showAll, setShowAll] = useState(false);

  if (resources.length === 0) {
    return <EmptyState message="No cost data for this period yet." />;
  }

  const top = resources.slice(0, TOP_N);
  const visibleRows = showAll ? resources : resources.slice(0, TOP_N);

  return (
    <div>
      <h2 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">
        Top {Math.min(TOP_N, resources.length)} resources
      </h2>
      <ResponsiveContainer width="100%" height={Math.max(280, top.length * 32)}>
        <BarChart data={top} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="var(--gridline)" horizontal={false} />
          <XAxis
            type="number"
            stroke="var(--axis)"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickFormatter={(v: number) => formatCompactCurrency(v, currency)}
          />
          <YAxis
            type="category"
            dataKey="resourceName"
            width={220}
            stroke="var(--axis)"
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          />
          <Tooltip
            content={(props) => <ChartTooltip {...props} currency={currency} />}
            cursor={{ fill: "var(--gridline)", opacity: 0.4 }}
          />
          <Bar dataKey="cost" fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>

      <div className="mb-2 mt-8 flex items-center justify-between">
        <h2 className="text-sm font-medium text-[var(--text-secondary)]">All {resources.length} resources</h2>
        {resources.length > TOP_N && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-[var(--text-secondary)] underline underline-offset-2"
          >
            {showAll ? "Show top 10 only" : `Show all ${resources.length}`}
          </button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
            <th className="py-2 font-medium">Resource</th>
            <th className="py-2 font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((r) => (
            <tr key={r.resourceId} className="border-b border-[var(--border)]">
              <td className="py-2">{r.resourceName}</td>
              <td className="py-2 tabular-nums">{formatCurrency(r.cost, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
