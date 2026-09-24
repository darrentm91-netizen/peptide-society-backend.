import { NextResponse } from "next/server";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";
import { approveBatch } from "@/services/batch-lifecycle";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(request); if (isAuthResponse(admin)) return admin;
  try { const { id } = await params; return NextResponse.json({ batch: await approveBatch(id, admin.userId) }); }
  catch (error) { return NextResponse.json({ error:error instanceof Error?error.message:"Approval failed" },{status:400}); }
}
