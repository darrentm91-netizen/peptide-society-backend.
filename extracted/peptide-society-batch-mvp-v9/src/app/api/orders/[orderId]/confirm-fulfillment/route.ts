import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";
import { confirmFulfillment } from "@/services/order-lots";
const schema=z.object({assignmentId:z.string().min(1)});
export async function POST(request:Request){const admin=requireAdmin(request);if(isAuthResponse(admin))return admin;try{const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Invalid request",details:parsed.error.flatten()},{status:400});return NextResponse.json({assignment:await confirmFulfillment({assignmentId:parsed.data.assignmentId,userId:admin.userId})});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Fulfillment failed"},{status:400});}}
