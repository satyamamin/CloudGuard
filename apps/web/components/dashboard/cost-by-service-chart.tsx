"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, TooltipContentProps, XAxis, YAxis } from "recharts";
import { ServiceCost } from "@finops-lab/shared";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { EmptyState } from "./empty-state";

interface CostByServiceChartProps {
  services: ServiceCost[];
  currency: string;
}

function ChartTooltip({ active, payload, currency }: TooltipContentProps & { currency: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as ServiceCost | undefined;
  if (!point) return null;
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--chart-surface)] px-3 py-2 shadow-sm">
      <p className="text-xs text-[var(--text-secondary)]">{point.serviceName}</p>
      <p className="text-sm font-semibold text-[var(--text-primary)]">{formatCurrency(point.cost, currency)}</p>
    </div>
  );
}

export function CostByServiceChart({ services, currency }: CostByServiceChartProps) {
  const [showTable, setShowTable] = useState(false);

  if (services.length === 0) {
    return <EmptyState message="No cost data for this period yet." />;
  }

  // Bars are already sorted descending by cost from the API — a magnitude
  // comparison across categories, so one sequential hue (not per-category
  // color) per the dataviz skill's "compare magnitude -> sequential" rule.
  const chartHeight = Math.max(320, services.length * 28);

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          onClick={() => setShowTable((v) => !v)}
          className="text-xs text-[var(--text-secondary)] underline underline-offset-2"
        >
          {showTable ? "View as chart" : "View as table"}
        </button>
      </div>

      {showTable ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
              <th className="py-2 font-medium">Service</th>
              <th className="py-2 font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.serviceName} className="border-b border-[var(--border)]">
                <td className="py-2">{s.serviceName}</td>
                <td className="py-2 tabular-nums">{formatCurrency(s.cost, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={services} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="var(--gridline)" horizontal={false} />
            <XAxis
              type="number"
              stroke="var(--axis)"
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickFormatter={(v: number) => formatCompactCurrency(v, currency)}
            />
            <YAxis
              type="category"
              dataKey="serviceName"
              width={160}
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
      )}
    </div>
  );
}
