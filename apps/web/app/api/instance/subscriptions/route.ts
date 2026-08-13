import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { selectSubscriptionsRequestSchema } from "@finops-lab/shared";
import { getInstancePairing } from "@/lib/clerk-org-metadata";
import { backendClientFor } from "@/lib/backend-client";

async function requirePairedClient(orgId: string) {
  const pairing = await getInstancePairing(orgId);
  if (!pairing) return null;
  return backendClientFor(pairing);
}

export async function GET() {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 401 });

  const client = await requirePairedClient(orgId);
  if (!client) return NextResponse.json({ error: "No instance paired yet" }, { status: 409 });

  return NextResponse.json(await client.listSubscriptions());
}

export async function POST(request: NextRequest) {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 401 });

  const client = await requirePairedClient(orgId);
  if (!client) return NextResponse.json({ error: "No instance paired yet" }, { status: 409 });

  const parsed = selectSubscriptionsRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await client.selectSubscriptions(parsed.data.subscriptionIds);
  return NextResponse.json({ ok: true });
}
