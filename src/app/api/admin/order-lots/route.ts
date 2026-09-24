import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const admin = requireAdmin(request);
  if (isAuthResponse(admin)) return admin;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const assignments = await prisma.orderLotAssignment.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: { createdAt: "desc" },
    take: 250,
    include: {
      product: { select: { id: true, name: true, sku: true } },
      psBatch: { select: { id: true, psLotNumber: true, batchStatus: true } },
    },
  });

  return NextResponse.json({ actor: admin.userId, assignments });
}
