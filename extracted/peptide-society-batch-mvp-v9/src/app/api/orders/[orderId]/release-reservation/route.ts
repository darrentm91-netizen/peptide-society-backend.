import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";
import { releaseReservation } from "@/services/order-lots";
const schema=z.object({assignmentId:z.string().min(1),reason:z.string().trim().min(3).max(500)});
export async function POST(request:Request){const admin=requireAdmin(request);if(isAuthResponse(admin))return admin;try{const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Invalid request",details:parsed.error.flatten()},{status:400});return NextResponse.json({assignment:await releaseReservation({...parsed.data,userId:admin.userId})});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Release failed"},{status:400});}}
