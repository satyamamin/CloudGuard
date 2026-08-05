import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getInstancePairing } from "@/lib/clerk-org-metadata";
import { backendClientFor } from "@/lib/backend-client";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { SubscriptionSwitcher } from "@/components/dashboard/subscription-switcher";
import { PeriodSelector } from "@/components/dashboard/period-selector";

// Server component: reads the pairing + subscriptions directly for the shell
// chrome (nav, subscription/period selectors), same "no round-trip through
// /api/instance for first paint" reasoning as app/connect-azure/page.tsx.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { orgId } = auth();
  if (!orgId) redirect("/connect-azure");

  const pairing = await getInstancePairing(orgId);
  if (!pairing) redirect("/connect-azure");

  const client = backendClientFor(pairing);
  const [subscriptions, status] = await Promise.all([client.listSubscriptions(), client.status()]);

  return (
    <div className="dashboard-root min-h-screen bg-[var(--page-plane)] text-[var(--text-primary)]">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <DashboardNav />
          <div className="flex items-center gap-3">
            <SubscriptionSwitcher subscriptions={subscriptions} selectedIds={status.selectedSubscriptionIds} />
            <PeriodSelector />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
