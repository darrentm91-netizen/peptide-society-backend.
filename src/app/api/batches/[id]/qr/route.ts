import { NextResponse } from "next/server";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";
import { ensureBatchQr } from "@/services/qr-verification";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin=requireAdmin(request); if(isAuthResponse(admin)) return admin;
  try { const {id}=await params; return NextResponse.json({qr:await ensureBatchQr(id,admin.userId)}); }
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"QR generation failed"},{status:400});}
}
