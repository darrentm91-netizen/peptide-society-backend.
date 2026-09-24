import { NextRequest, NextResponse } from "next/server";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";
import { getImpactedOrders } from "@/services/batch-recall";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(request);
  if (isAuthResponse(admin)) return admin;
  try {
    const { id } = await params;
    return NextResponse.json(await getImpactedOrders(id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load impacted orders";
    return NextResponse.json({ error: message }, { status: message.includes("not found") ? 404 : 400 });
  }
}
