import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";
import { recallBatch } from "@/services/batch-recall";

const schema = z.object({ reason: z.string().trim().min(5).max(1000) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(request);
  if (isAuthResponse(admin)) return admin;
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    const { id } = await params;
    return NextResponse.json(await recallBatch({ batchId: id, userId: admin.userId, reason: parsed.data.reason }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Recall failed" }, { status: 400 });
  }
}
