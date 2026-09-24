import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readStoredDocument } from "@/lib/document-storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; filename: string }> }) {
  try {
    const { id, filename } = await params;
    const doc = await prisma.batchDocument.findFirst({
      where: {
        psBatchId: id,
        fileName: filename,
        approved: true,
        publicVisible: true,
        supersededAt: null,
      },
      orderBy: { versionNumber: "desc" },
    });
    if (!doc) return NextResponse.json({ error: "Document not available" }, { status: 404 });
    const body = await readStoredDocument(doc.storageUrl);
    const downloadName = doc.fileName.replace(/["\r\n]/g, "");
    return new Response(body, {
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${downloadName}"`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Document not available" }, { status: 404 });
  }
}
