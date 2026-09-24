import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";

function publicVerifyPageUrl() {
  return (process.env.PUBLIC_VERIFY_BASE_URL || "http://localhost:3000/pages/verify-batch").replace(/\/$/, "");
}

function verificationUrlFor(lotNumber: string, token: string) {
  const url = new URL(publicVerifyPageUrl());
  url.searchParams.set("lot", lotNumber);
  url.searchParams.set("t", token);
  return url.toString();
}

export async function ensureBatchQr(batchId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.psBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new Error("Batch not found");

    const current = await tx.batchQrCode.findFirst({ where: { psBatchId: batchId, active: true }, orderBy: { createdAt: "desc" } });
    if (current) {
      const expectedUrl = verificationUrlFor(batch.psLotNumber, current.verificationToken);
      const currentRecord = current.verificationUrl === expectedUrl
        ? current
        : await tx.batchQrCode.update({ where: { id: current.id }, data: { verificationUrl: expectedUrl } });
      const svg = await QRCode.toString(currentRecord.verificationUrl, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
      return { ...currentRecord, svg };
    }

    const verificationToken = randomBytes(18).toString("base64url");
    const verificationUrl = verificationUrlFor(batch.psLotNumber, verificationToken);
    const qr = await tx.batchQrCode.create({ data: { psBatchId: batchId, verificationToken, verificationUrl } });
    await tx.auditEvent.create({
      data: {
        userId,
        entityType: "BATCH_QR",
        entityId: qr.id,
        psBatchId: batchId,
        action: "QR_CREATED",
        newValueJson: { verificationUrl },
      },
    });
    const svg = await QRCode.toString(verificationUrl, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
    return { ...qr, svg };
  });
}
