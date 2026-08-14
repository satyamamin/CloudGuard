"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DailyCost } from "@finops-lab/shared";
import { formatCompactCurrency, formatCurrency, formatDateLabel } from "@/lib/format";
import { EmptyState } from "./empty-state";

interface DailyCostChartProps {
  days: DailyCost[];
  currency: string;
}

// Recharts' own Tooltip content-prop typing doesn't play well with this
// toolchain (see CLAUDE.md) -- ChartTooltipBody takes plain, already-coerced
// values instead of recharts' own prop types, so there's no cross-type
// boundary for TypeScript to fight with. The <Tooltip content={...}> callback
// below is left with an inferred (untyped) parameter for the same reason.
function ChartTooltipBody({ label, value, currency }: { label: string; value: number; currency: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--chart-surface)] px-3 py-2 shadow-sm">
      <p className="text-xs text-[var(--text-secondary)]">{formatDateLabel(label)}</p>
      <p className="text-sm font-semibold text-[var(--text-primary)]">{formatCurrency(value, currency)}</p>
    </div>
  );
}

export function DailyCostChart({ days, currency }: DailyCostChartProps) {
  const [showTable, setShowTable] = useState(false);

  if (days.length === 0) {
    return <EmptyState message="No cost data for this period yet." />;
  }

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
              <th className="py-2 font-medium">Date</th>
              <th className="py-2 font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} className="border-b border-[var(--border)]">
                <td className="py-2">{formatDateLabel(d.date)}</td>
                <td className="py-2 tabular-nums">{formatCurrency(d.cost, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
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
            <Tooltip
              content={(props) =>
                props.active && props.payload?.length ? (
                  <ChartTooltipBody
                    label={String(props.label)}
                    value={Number(props.payload[0]?.value ?? 0)}
                    currency={currency}
                  />
                ) : null
              }
            />
            <Area type="monotone" dataKey="cost" stroke="var(--series-1)" strokeWidth={2} fill="var(--series-1)" fillOpacity={0.1} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
