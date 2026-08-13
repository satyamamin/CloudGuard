import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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

  return NextResponse.json(await client.status());
}

export async function POST() {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 401 });

  const client = await requirePairedClient(orgId);
  if (!client) return NextResponse.json({ error: "No instance paired yet" }, { status: 409 });

  return NextResponse.json(await client.sync());
}
