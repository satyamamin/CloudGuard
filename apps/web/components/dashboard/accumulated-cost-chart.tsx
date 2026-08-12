"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, TooltipContentProps, XAxis, YAxis } from "recharts";
import { AccumulatedCost } from "@finops-lab/shared";
import { formatCompactCurrency, formatCurrency, formatDateLabel } from "@/lib/format";
import { EmptyState } from "./empty-state";

interface AccumulatedCostChartProps {
  days: AccumulatedCost[];
  currency: string;
}

function ChartTooltip({ active, payload, label, currency }: TooltipContentProps & { currency: string }) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--chart-surface)] px-3 py-2 shadow-sm">
      <p className="text-xs text-[var(--text-secondary)]">{formatDateLabel(String(label))}</p>
      <p className="text-sm font-semibold text-[var(--text-primary)]">{formatCurrency(value, currency)}</p>
    </div>
  );
}

export function AccumulatedCostChart({ days, currency }: AccumulatedCostChartProps) {
  if (days.length === 0) {
    return <EmptyState message="No cost data for this period yet." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={days} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="var(--gridline)" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="var(--axis)"
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          tickFormatter={formatDateLabel}
        />
        <YAxis
          stroke="var(--axis)"
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          tickFormatter={(v: number) => formatCompactCurrency(v, currency)}
        />
        <Tooltip content={(props) => <ChartTooltip {...props} currency={currency} />} />
        <Area
          type="monotone"
          dataKey="cumulativeCost"
          stroke="var(--series-1)"
          strokeWidth={2}
          fill="var(--series-1)"
          fillOpacity={0.1}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
