import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";
import { quarantineReturnedQuantity } from "@/services/order-lots";
import { writeOrderLotAssignmentsToShopify } from "@/services/shopify-order-metafield";
const schema = z.object({ quantity: z.number().int().positive(), reason: z.string().trim().min(5).max(1000) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin=requireAdmin(request); if(isAuthResponse(admin)) return admin;
  try {
    const parsed=schema.safeParse(await request.json()); if(!parsed.success) return NextResponse.json({error:"Invalid request",details:parsed.error.flatten()},{status:400});
    const {id}=await params; const assignment=await quarantineReturnedQuantity({assignmentId:id,userId:admin.userId,...parsed.data});
    await writeOrderLotAssignmentsToShopify(assignment.shopifyOrderId);
    return NextResponse.json({assignment});
  } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Return failed"},{status:400}); }
}
