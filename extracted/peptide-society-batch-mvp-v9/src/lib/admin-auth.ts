import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export type AdminIdentity = { userId: string };

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function authenticateAdmin(request: Request): AdminIdentity | null {
  const expected = process.env.PS_ADMIN_API_KEY;
  if (!expected) throw new Error("PS_ADMIN_API_KEY is not configured");
  const auth = request.headers.get("authorization");
  const headerKey = request.headers.get("x-ps-admin-key");
  const supplied = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : headerKey?.trim();
  if (!supplied || !safeEqual(supplied, expected)) return null;
  const userId = request.headers.get("x-ps-admin-user")?.trim() || "admin:api";
  return { userId };
}

export function requireAdmin(request: Request): AdminIdentity | NextResponse {
  try {
    const identity = authenticateAdmin(request);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return identity;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin authentication is unavailable";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export function isAuthResponse(value: AdminIdentity | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
