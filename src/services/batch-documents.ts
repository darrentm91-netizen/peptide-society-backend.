import { DocumentType, TestingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { storeBatchDocument } from "@/lib/document-storage";

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);
const MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function addBatchDocument(args: {
  batchId: string;
  documentType: DocumentType;
  file: File;
  userId: string;
  laboratoryName?: string;
  testDate?: Date;
  purityResult?: number;
  identityResult?: string;
  publicVisible?: boolean;
}) {
  if (!ALLOWED_MIME_TYPES.has(args.file.type)) throw new Error("Only PDF, PNG, and JPEG documents are allowed");
  if (args.file.size <= 0 || args.file.size > MAX_FILE_BYTES) throw new Error("Document must be between 1 byte and 15 MB");

  return prisma.$transaction(async (tx) => {
    const batch = await tx.psBatch.findUnique({ where: { id: args.batchId } });
    if (!batch) throw new Error("Batch not found");

    const latest = await tx.batchDocument.findFirst({
      where: { psBatchId: args.batchId, documentType: args.documentType },
      orderBy: { versionNumber: "desc" },
    });
    const versionNumber = (latest?.versionNumber ?? 0) + 1;

    const stored = await storeBatchDocument({
      psLotNumber: batch.psLotNumber,
      documentType: args.documentType,
      versionNumber,
      file: args.file,
    });

    if (latest && !latest.supersededAt) {
      await tx.batchDocument.update({ where: { id: latest.id }, data: { supersededAt: new Date() } });
    }

    const document = await tx.batchDocument.create({
      data: {
        psBatchId: args.batchId,
        documentType: args.documentType,
        versionNumber,
        laboratoryName: args.laboratoryName,
        testDate: args.testDate,
        purityResult: args.purityResult,
        identityResult: args.identityResult,
        storageUrl: stored.storageRef,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        fileSizeBytes: stored.size,
        publicVisible: args.publicVisible ?? false,
        createdBy: args.userId,
      },
    });

    let testingStatus = batch.testingStatus;
    if (args.documentType === DocumentType.MANUFACTURER_COA && testingStatus === TestingStatus.NOT_STARTED) {
      testingStatus = TestingStatus.MANUFACTURER_DOCUMENTED;
    } else if ([DocumentType.INDEPENDENT_COA, DocumentType.IDENTITY_TEST, DocumentType.PURITY_TEST].includes(args.documentType)) {
      testingStatus = TestingStatus.REVIEW_REQUIRED;
    }
    if (testingStatus !== batch.testingStatus) {
      await tx.psBatch.update({ where: { id: args.batchId }, data: { testingStatus } });
    }

    await tx.auditEvent.create({
      data: {
        userId: args.userId,
        entityType: "BATCH_DOCUMENT",
        entityId: document.id,
        psBatchId: args.batchId,
        action: "DOCUMENT_UPLOADED",
        newValueJson: { documentType: args.documentType, versionNumber, fileName: document.fileName, publicVisible: document.publicVisible },
      },
    });
    return document;
  });
}

export async function approveBatchDocument(documentId: string, userId: string, publicVisible?: boolean) {
  return prisma.$transaction(async (tx) => {
    const document = await tx.batchDocument.findUnique({ where: { id: documentId } });
    if (!document) throw new Error("Document not found");
    const updated = await tx.batchDocument.update({
      where: { id: documentId },
      data: { approved: true, approvedBy: userId, approvedAt: new Date(), ...(publicVisible === undefined ? {} : { publicVisible }) },
    });

    const batch = await tx.psBatch.findUnique({ where: { id: document.psBatchId } });
    if (batch && [DocumentType.INDEPENDENT_COA, DocumentType.IDENTITY_TEST, DocumentType.PURITY_TEST].includes(document.documentType)) {
      const approvedIndependentDocs = await tx.batchDocument.findMany({
        where: {
          psBatchId: document.psBatchId,
          approved: true,
          supersededAt: null,
          documentType: { in: [DocumentType.INDEPENDENT_COA, DocumentType.IDENTITY_TEST, DocumentType.PURITY_TEST] },
        },
        select: { documentType: true },
      });
      const types = new Set(approvedIndependentDocs.map((d) => d.documentType));
      const independentlyVerified =
        types.has(DocumentType.INDEPENDENT_COA) ||
        (types.has(DocumentType.IDENTITY_TEST) && types.has(DocumentType.PURITY_TEST));
      await tx.psBatch.update({
        where: { id: batch.id },
        data: { testingStatus: independentlyVerified ? TestingStatus.INDEPENDENT_VERIFIED : TestingStatus.REVIEW_REQUIRED },
      });
    }

    await tx.auditEvent.create({
      data: {
        userId,
        entityType: "BATCH_DOCUMENT",
        entityId: documentId,
        psBatchId: document.psBatchId,
        action: "DOCUMENT_APPROVED",
        oldValueJson: { approved: document.approved, publicVisible: document.publicVisible },
        newValueJson: { approved: updated.approved, publicVisible: updated.publicVisible },
      },
    });
    return updated;
  });
}
