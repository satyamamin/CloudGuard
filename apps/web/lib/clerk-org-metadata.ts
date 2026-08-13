import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { InstancePairing, MaskedInstancePairing, instancePairingSchema, maskApiKey } from "@finops-lab/shared";

// The API key must live in Clerk PRIVATE organization metadata, never public
// metadata — public metadata is readable client-side by any org member via
// the Clerk React SDK. This file is the only place that reads/writes it,
// and it's marked server-only so it can never be imported into a client
// component by accident. See docs/byoc/connect-azure.md's "store it masked"
// rule — this is the concrete mechanism behind that rule.

interface PrivateMetadata {
  instancePairing?: InstancePairing;
}

export async function getInstancePairing(orgId: string): Promise<InstancePairing | null> {
  const client = await clerkClient();
  const org = await client.organizations.getOrganization({ organizationId: orgId });
  const metadata = org.privateMetadata as PrivateMetadata;
  const parsed = instancePairingSchema.safeParse(metadata.instancePairing);
  return parsed.success ? parsed.data : null;
}

export async function getMaskedInstancePairing(orgId: string): Promise<MaskedInstancePairing | null> {
  const pairing = await getInstancePairing(orgId);
  if (!pairing) return null;
  return { backendUrl: pairing.backendUrl, apiKeyLast4: maskApiKey(pairing.apiKey) };
}

export async function setInstancePairing(orgId: string, pairing: InstancePairing): Promise<void> {
  const client = await clerkClient();
  await client.organizations.updateOrganizationMetadata(orgId, {
    privateMetadata: { instancePairing: pairing } satisfies PrivateMetadata,
  });
}
