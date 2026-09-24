import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";
import { correctFulfilledLotAssignment } from "@/services/order-lots";
import { writeOrderLotAssignmentsToShopify } from "@/services/shopify-order-metafield";
const schema = z.object({ targetBatchId: z.string().min(1), reason: z.string().trim().min(8).max(1000) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin=requireAdmin(request); if(isAuthResponse(admin)) return admin;
  try {
    const parsed=schema.safeParse(await request.json()); if(!parsed.success) return NextResponse.json({error:"Invalid request",details:parsed.error.flatten()},{status:400});
    const {id}=await params; const assignment=await correctFulfilledLotAssignment({assignmentId:id,userId:admin.userId,...parsed.data});
    await writeOrderLotAssignmentsToShopify(assignment.shopifyOrderId);
    return NextResponse.json({assignment});
  } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Correction failed"},{status:400}); }
}
