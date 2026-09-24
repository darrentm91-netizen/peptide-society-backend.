import { DocumentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { addBatchDocument } from "@/services/batch-documents";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";

const metadataSchema = z.object({
  documentType: z.nativeEnum(DocumentType),
  laboratoryName: z.string().trim().max(200).optional(),
  testDate: z.coerce.date().optional(),
  purityResult: z.coerce.number().min(0).max(100).optional(),
  identityResult: z.string().trim().max(300).optional(),
  publicVisible: z.preprocess(
    (value) => value === "true" ? true : value === "false" ? false : value,
    z.boolean().optional(),
  ),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(request);
  if (isAuthResponse(admin)) return admin;
  const { id } = await params;
  const documents = await prisma.batchDocument.findMany({
    where: { psBatchId: id },
    orderBy: [{ documentType: "asc" }, { versionNumber: "desc" }],
  });
  return NextResponse.json({ documents });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(request);
  if (isAuthResponse(admin)) return admin;
  try {
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
    const parsed = metadataSchema.safeParse(Object.fromEntries([...form.entries()].filter(([key]) => key !== "file")));
    if (!parsed.success) return NextResponse.json({ error: "Invalid metadata", details: parsed.error.flatten() }, { status: 400 });
    const document = await addBatchDocument({ batchId: id, file, ...parsed.data, userId: admin.userId });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 400 });
  }
}
