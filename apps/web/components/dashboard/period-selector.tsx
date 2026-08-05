"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const PRESETS = [7, 30, 90];
const DEFAULT_DAYS = 30;

export function PeriodSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentDays = Number(searchParams.get("days")) || DEFAULT_DAYS;

  function setDays(days: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("days", String(days));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="inline-flex rounded-md border border-[var(--border)] overflow-hidden">
      {PRESETS.map((days) => (
        <button
          key={days}
          onClick={() => setDays(days)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium transition-colors",
            days === currentDays ? "bg-[var(--series-1)] text-white" : "text-[var(--text-secondary)] hover:bg-black/5",
          )}
        >
          {days}d
        </button>
      ))}
    </div>
  );
}
