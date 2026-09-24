import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAllowedStorefrontOrigin, publicCorsHeaders } from "@/lib/public-cors";

export async function OPTIONS(request: Request) {
  const headers = publicCorsHeaders(request);
  if (!isAllowedStorefrontOrigin(request)) {
    return new NextResponse(null, { status: 403, headers });
  }
  return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: Request, { params }: { params: Promise<{ lotNumber: string }> }) {
  const headers = publicCorsHeaders(request);
  if (!isAllowedStorefrontOrigin(request)) {
    return NextResponse.json({ verified: false, error: "Storefront origin is not allowed" }, { status: 403, headers });
  }

  const { lotNumber } = await params;
  const token = new URL(request.url).searchParams.get("t");
  const batch = await prisma.psBatch.findUnique({
    where: { psLotNumber: decodeURIComponent(lotNumber).toUpperCase() },
    include: {
      product: true,
      manufacturerBatch: true,
      documents: { where: { approved: true, publicVisible: true, supersededAt: null }, orderBy: { createdAt: "desc" } },
      qrCodes: { where: { active: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!batch) return NextResponse.json({ verified: false, error: "Batch not found" }, { status: 404, headers });
  if (token && batch.qrCodes[0]?.verificationToken !== token) {
    return NextResponse.json({ verified: false, error: "Verification token is invalid" }, { status: 403, headers });
  }

  return NextResponse.json({
    verified: true,
    batch: {
      lotNumber: batch.psLotNumber,
      product: batch.product.name,
      strengthValue: batch.product.strengthValue,
      strengthUnit: batch.product.strengthUnit,
      batchStatus: batch.batchStatus,
      testingStatus: batch.testingStatus,
      manufacturerLotNumber: batch.manufacturerBatch.manufacturerLotNumber,
      manufactureDate: batch.manufacturerBatch.manufactureDate,
      expirationOrRetestDate: batch.manufacturerBatch.expirationOrRetestDate,
      receivedDate: batch.receivedDate,
      recalledAt: batch.recalledAt,
      recallNotice: batch.batchStatus === "RECALLED" ? batch.recalledReason : null,
      documents: batch.documents.map((d) => ({
        id: d.id,
        documentType: d.documentType,
        versionNumber: d.versionNumber,
        laboratoryName: d.laboratoryName,
        testDate: d.testDate,
        purityResult: d.purityResult,
        identityResult: d.identityResult,
        fileName: d.fileName,
        storageUrl: `/api/batches/${batch.id}/documents/${encodeURIComponent(d.fileName)}`,
      })),
    },
  }, { headers: { ...headers, "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
