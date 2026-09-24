import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const admin = requireAdmin(request);
  if (isAuthResponse(admin)) return admin;

  const url = new URL(request.url);
  const approval = url.searchParams.get("approval");
  const documents = await prisma.batchDocument.findMany({
    where: approval === "pending" ? { approved: false, supersededAt: null } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      psBatch: {
        select: {
          id: true,
          psLotNumber: true,
          batchStatus: true,
          product: { select: { id: true, name: true, sku: true } },
        },
      },
    },
  });

  return NextResponse.json({ actor: admin.userId, documents });
}
