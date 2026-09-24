import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";
import { holdBatch } from "@/services/batch-lifecycle";
const schema=z.object({reason:z.string().trim().min(3).max(500)});
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin=requireAdmin(request); if(isAuthResponse(admin)) return admin;
  try { const {id}=await params; const parsed=schema.safeParse(await request.json()); if(!parsed.success)return NextResponse.json({error:"Invalid request",details:parsed.error.flatten()},{status:400}); return NextResponse.json({batch:await holdBatch(id,admin.userId,parsed.data.reason)}); }
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Hold failed"},{status:400});}
}
