import { NextResponse } from "next/server";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";
import { auditInventoryInvariants } from "@/lib/inventory-audit";

export async function GET(request: Request) {
  const admin = requireAdmin(request);
  if (isAuthResponse(admin)) return admin;
  const violations = await auditInventoryInvariants();
  return NextResponse.json({ actor: admin.userId, healthy: violations.length === 0, violationCount: violations.length, violations });
}
