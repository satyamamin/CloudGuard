import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getInstancePairing } from "@/lib/clerk-org-metadata";
import { backendClientFor } from "@/lib/backend-client";

// Entry-point redirect gate rather than a static landing page: sends the
// visitor to whichever step of the funnel they're actually at, so nobody
// has to remember where they left off.
//   not signed in / no pairing yet -> /deploy-azure
//   paired but no subscriptions selected yet -> /connect-azure (finish onboarding)
//   paired and onboarded -> /dashboard
export default async function HomePage() {
  const { orgId } = auth();
  if (!orgId) {
    redirect("/deploy-azure");
  }

  const pairing = await getInstancePairing(orgId);
  if (!pairing) {
    redirect("/deploy-azure");
  }

  // next/navigation's redirect() works by throwing internally — it must
  // never sit inside this try block, or the catch below would silently
  // swallow it and no redirect would happen at all.
  let isOnboarded = false;
  try {
    const status = await backendClientFor(pairing).status();
    isOnboarded = status.selectedSubscriptionIds.length > 0;
  } catch {
    // Backend unreachable or erroring — fall through to /connect-azure,
    // which already has its own error handling for this.
  }

  redirect(isOnboarded ? "/dashboard" : "/connect-azure");
}
