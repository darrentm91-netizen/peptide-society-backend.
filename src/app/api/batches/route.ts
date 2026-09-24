import { NextResponse } from "next/server";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";
import { createBatchSchema } from "@/schemas/create-batch";
import { createBatch } from "@/services/create-batch";
export async function POST(request: Request) {
  const admin=requireAdmin(request); if(isAuthResponse(admin)) return admin;
  try {
    const parsed=createBatchSchema.safeParse(await request.json());
    if(!parsed.success)return NextResponse.json({error:"Invalid request",details:parsed.error.flatten()},{status:400});
    const batch=await createBatch({...parsed.data,createdByUserId:admin.userId});
    return NextResponse.json({batch},{status:201});
  } catch(error){const message=error instanceof Error?error.message:"Unable to create batch";const status=message.includes("not found")?404:message.includes("already")?409:400;return NextResponse.json({error:message},{status});}
}


export async function GET(request: Request) {
  const admin = requireAdmin(request);
  if (isAuthResponse(admin)) return admin;
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const productId = url.searchParams.get("productId");
  const batches = await (await import("@/lib/prisma")).prisma.psBatch.findMany({
    where: {
      ...(status ? { batchStatus: status as any } : {}),
      ...(productId ? { productId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { id: true, name: true, sku: true, lotCode: true } },
      manufacturerBatch: { select: { manufacturerLotNumber: true, expirationOrRetestDate: true } },
      documents: { select: { id: true, documentType: true, versionNumber: true, approved: true, publicVisible: true, supersededAt: true } },
    },
    take: 200,
  });
  return NextResponse.json({ batches });
}
