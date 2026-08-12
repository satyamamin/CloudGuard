"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AzureSubscription } from "@finops-lab/shared";

interface SubscriptionSwitcherProps {
  subscriptions: AzureSubscription[];
  selectedIds: string[];
}

// Only the subscriptions the backend actually has selected are relevant here
// — /costs/* endpoints only have synced context for those.
export function SubscriptionSwitcher({ subscriptions, selectedIds }: SubscriptionSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const relevant = subscriptions.filter((s) => selectedIds.includes(s.azureSubscriptionId));
  const current = searchParams.get("subscriptionId") || relevant[0]?.azureSubscriptionId || "";

  if (relevant.length === 0) return null;

  if (relevant.length === 1) {
    return <span className="text-sm text-[var(--text-secondary)]">{relevant[0].displayName}</span>;
  }

  function setSubscription(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("subscriptionId", id);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => setSubscription(e.target.value)}
      className="rounded-md border border-[var(--border)] bg-[var(--chart-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
    >
      {relevant.map((s) => (
        <option key={s.azureSubscriptionId} value={s.azureSubscriptionId}>
          {s.displayName}
        </option>
      ))}
    </select>
  );
}
