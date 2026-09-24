import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";
import { approveBatchDocument } from "@/services/batch-documents";
const schema=z.object({publicVisible:z.boolean().optional()});
export async function POST(request: Request,{params}:{params:Promise<{id:string}>}){
  const admin=requireAdmin(request); if(isAuthResponse(admin)) return admin;
  try{const{id}=await params;const parsed=schema.safeParse(await request.json().catch(()=>({})));if(!parsed.success)return NextResponse.json({error:"Invalid request",details:parsed.error.flatten()},{status:400});return NextResponse.json({document:await approveBatchDocument(id,admin.userId,parsed.data.publicVisible)});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Approval failed"},{status:400});}
}
