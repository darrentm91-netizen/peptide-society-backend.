import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const admin = requireAdmin(request);
  if (isAuthResponse(admin)) return admin;

  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      shopifyProductId: true,
      shopifyVariantId: true,
      sku: true,
      name: true,
      lotCode: true,
      vialTemplate: true,
      batchTrackingEnabled: true,
      active: true,
      _count: { select: { psBatches: true } },
    },
  });
  return NextResponse.json({ actor: admin.userId, products });
}
