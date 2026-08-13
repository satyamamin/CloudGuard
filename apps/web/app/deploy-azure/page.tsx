import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DeployButton } from "@/components/connect-azure/deploy-button";
import { PRODUCT_NAME } from "@/lib/product-name";
import { getInstancePairing } from "@/lib/clerk-org-metadata";
import { backendClientFor } from "@/lib/backend-client";

// Standalone deploy step, split out from /connect-azure so the Deploy-to-
// Azure link has a quick, bookmarkable entry point that doesn't require
// being signed in first (this route isn't in proxy.ts's protected
// matcher). Pairing still happens on /connect-azure after the deployment
// finishes and outputs a Backend URL + API key.
export default async function DeployAzurePage() {
  // Already fully onboarded (paired + subscriptions selected)? This page's
  // job is done — send them to the dashboard instead of the deploy screen.
  // Same must-not-be-inside-try-catch caveat as app/page.tsx: redirect()
  // throws internally.
  const { orgId } = await auth();
  if (orgId) {
    const pairing = await getInstancePairing(orgId);
    if (pairing) {
      let isOnboarded = false;
      try {
        const status = await backendClientFor(pairing).status();
        isOnboarded = status.selectedSubscriptionIds.length > 0;
      } catch {
        // Backend unreachable — let them see this page rather than block on it.
      }
      if (isOnboarded) {
        redirect("/dashboard");
      }
    }
  }

  // Computed from the incoming request rather than hardcoded, so the
  // frontendOrigin reminder below stays correct whether this is running on
  // localhost during dev or the eventual production domain — no edit
  // needed when apps/web moves to Vercel. headers() is async as of
  // Next.js 15+ (sync access fully removed in 16).
  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold text-slate-900">Deploy to Azure</h1>
      <p className="mt-2 text-sm text-slate-600">
        Provisions {PRODUCT_NAME}&apos;s backend directly inside your own Azure tenant — your cost data never leaves
        it.
      </p>

      <Card className="mt-8">
        <CardTitle>Before you click Deploy</CardTitle>
        <CardDescription>A few things the Azure Portal will ask for:</CardDescription>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-500">
          <li>
            You need <span className="font-semibold text-slate-900">Owner</span> (or{" "}
            <span className="font-semibold text-slate-900">User Access Administrator</span> +{" "}
            <span className="font-semibold text-slate-900">Contributor</span>) on the subscription — the template
            grants the backend&apos;s Managed Identity Reader and Cost Management Reader access, which requires
            permission to create role assignments. Contributor alone isn&apos;t enough and the deployment will fail.
          </li>
          <li>Pick the Azure subscription you want {PRODUCT_NAME} to monitor.</li>
          <li>Choose or create a resource group in an EU region (data-residency requirement).</li>
          <li>
            Set <span className="font-mono text-xs">frontendOrigin</span> to{" "}
            <span className="font-mono text-xs font-semibold text-slate-900">{origin}</span> — this must match where
            you&apos;re viewing this page from, or the deployed backend will reject requests from it.
          </li>
          <li>Leave the API key and database password fields as their auto-generated defaults.</li>
        </ul>
        <div className="mt-4">
          <DeployButton />
        </div>
      </Card>

      <p className="mt-6 text-sm text-slate-600">
        Deployment takes a few minutes. When it finishes, the Azure Portal shows a Backend URL and API key — head to{" "}
        <a href="/connect-azure" className="underline">
          Connect Azure
        </a>{" "}
        to pair them with {PRODUCT_NAME}.
      </p>
    </main>
  );
}
