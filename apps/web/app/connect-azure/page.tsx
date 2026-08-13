import { auth } from "@clerk/nextjs/server";
import { getMaskedInstancePairing } from "@/lib/clerk-org-metadata";
import { PRODUCT_NAME } from "@/lib/product-name";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DeployButton } from "@/components/connect-azure/deploy-button";
import { PairingForm } from "@/components/connect-azure/pairing-form";
import { OnboardingWizard } from "./onboarding-wizard";

// Server component: reads the current pairing state directly (no need to
// round-trip through the /api/instance route for the initial render — that
// route exists for client-side mutations/refetches, this is the first paint).
export default async function ConnectAzurePage() {
  const { orgId } = await auth();
  const pairing = orgId ? await getMaskedInstancePairing(orgId) : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold text-slate-900">Connect Azure</h1>
      <p className="mt-2 text-sm text-slate-600">
        {PRODUCT_NAME} deploys its backend directly into your own Azure tenant — your cost data never leaves it.
      </p>

      <div className="mt-8 space-y-6">
        {!pairing && (
          <>
            <Card>
              <CardTitle>1. Deploy to your tenant</CardTitle>
              <CardDescription>
                Opens the Azure Portal. You&apos;ll pick a subscription, region (EU only), and resource group name.
              </CardDescription>
              <div className="mt-4">
                <DeployButton />
              </div>
            </Card>

            <Card>
              <CardTitle>2. Pair with {PRODUCT_NAME}</CardTitle>
              <CardDescription>Paste the Backend URL and API key shown at the end of the deployment.</CardDescription>
              <div className="mt-4">
                <OnboardingWizard initiallyPaired={false} />
              </div>
            </Card>
          </>
        )}

        {pairing && (
          <Card>
            <CardTitle>Connected</CardTitle>
            <CardDescription>
              Paired with {pairing.backendUrl} (key ending in {pairing.apiKeyLast4}).
            </CardDescription>
            <div className="mt-4">
              <OnboardingWizard initiallyPaired={true} />
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
