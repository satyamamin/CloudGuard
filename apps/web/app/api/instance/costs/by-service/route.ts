import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInstancePairing } from "@/lib/clerk-org-metadata";
import { backendClientFor } from "@/lib/backend-client";

export async function GET(request: NextRequest) {
  const { orgId } = auth();
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 401 });

  const pairing = await getInstancePairing(orgId);
  if (!pairing) return NextResponse.json({ error: "No instance paired yet" }, { status: 409 });

  const { searchParams } = request.nextUrl;
  const subscriptionId = searchParams.get("subscriptionId") ?? undefined;
  const days = searchParams.get("days") ? Number(searchParams.get("days")) : undefined;

  return NextResponse.json(await backendClientFor(pairing).costByService({ subscriptionId, days }));
}
