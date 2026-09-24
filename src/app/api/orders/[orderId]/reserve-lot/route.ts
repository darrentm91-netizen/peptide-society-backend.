import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";
import { reserveLot } from "@/services/order-lots";
const schema=z.object({orderLineId:z.string().min(1),productId:z.string().min(1),psBatchId:z.string().min(1),quantity:z.number().int().positive().max(100000)});
export async function POST(request:Request,{params}:{params:Promise<{orderId:string}>}){const admin=requireAdmin(request);if(isAuthResponse(admin))return admin;try{const{orderId}=await params;const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Invalid request",details:parsed.error.flatten()},{status:400});return NextResponse.json({assignment:await reserveLot({orderId,...parsed.data,userId:admin.userId})},{status:201});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Reservation failed"},{status:400});}}
