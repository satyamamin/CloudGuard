import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { instancePairingSchema } from "@finops-lab/shared";
import { getMaskedInstancePairing, setInstancePairing } from "@/lib/clerk-org-metadata";
import { backendClientFor } from "@/lib/backend-client";

export async function GET() {
  const { orgId } = auth();
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 401 });

  const pairing = await getMaskedInstancePairing(orgId);
  return NextResponse.json(pairing);
}

export async function POST(request: NextRequest) {
  const { orgId } = auth();
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 401 });

  const parsed = instancePairingSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Confirm the pairing actually works before persisting it (matches the
  // onboarding sequence in docs/byoc/connect-azure.md: "GET /health confirms the
  // pairing works" happens right after the customer pastes both values).
  try {
    await backendClientFor(parsed.data).health();
  } catch {
    return NextResponse.json({ error: "Could not reach backend with the provided URL/API key" }, { status: 422 });
  }

  await setInstancePairing(orgId, parsed.data);
  return NextResponse.json({ ok: true });
}
