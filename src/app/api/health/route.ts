import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ ok: true, service: "peptide-society-batch-mvp", timestamp: new Date().toISOString() });
}
