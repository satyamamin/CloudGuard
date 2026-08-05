interface KpiTileDelta {
  pct: number;
  // Which direction counts as "good" for this metric — for cost, that's down.
  goodDirection: "up" | "down";
}

interface KpiTileProps {
  label: string;
  value: string;
  subtitle?: string;
  delta?: KpiTileDelta | null;
}

// Figure contract from the dataviz skill: label (sentence case, no trailing
// colon) + value (semibold, auto-compact) + optional signed delta colored by
// direction x whether up is good.
export function KpiTile({ label, value, subtitle, delta }: KpiTileProps) {
  const isUp = delta ? delta.pct >= 0 : false;
  const isGood = delta ? (isUp ? delta.goodDirection === "up" : delta.goodDirection === "down") : false;
  const deltaColor = isGood ? "var(--delta-good)" : "var(--delta-bad)";

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--chart-surface)] p-4">
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</p>}
      {delta && (
        <p className="mt-1 text-xs" style={{ color: deltaColor }}>
          {isUp ? "+" : ""}
          {delta.pct.toFixed(1)}% vs prior period
        </p>
      )}
    </div>
  );
}
