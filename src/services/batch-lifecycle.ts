import { BatchStatus, DocumentType, TestingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

async function audit(tx: Prisma.TransactionClient, args: {
  userId: string; batchId: string; action: string; oldValue?: unknown; newValue?: unknown; reason?: string;
}) {
  await tx.auditEvent.create({
    data: {
      userId: args.userId,
      entityType: "PS_BATCH",
      entityId: args.batchId,
      psBatchId: args.batchId,
      action: args.action,
      oldValueJson: args.oldValue as never,
      newValueJson: args.newValue as never,
      reason: args.reason,
    },
  });
}

export async function approveBatch(batchId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.psBatch.findUnique({ where: { id: batchId }, include: { documents: true } });
    if (!batch) throw new Error("Batch not found");
    if ([BatchStatus.RECALLED, BatchStatus.ARCHIVED, BatchStatus.DEPLETED].includes(batch.batchStatus)) {
      throw new Error(`Cannot approve a ${batch.batchStatus.toLowerCase()} batch`);
    }
    const approvedManufacturerCoa = batch.documents.some((d) => d.documentType === DocumentType.MANUFACTURER_COA && d.approved);
    if (!approvedManufacturerCoa) throw new Error("Approved manufacturer COA is required before batch approval");
    if (batch.testingStatus === TestingStatus.REVIEW_REQUIRED) throw new Error("Testing review is still required");

    const oldStatus = batch.batchStatus;
    const updated = await tx.psBatch.update({ where: { id: batchId }, data: { batchStatus: BatchStatus.APPROVED } });
    await audit(tx, { userId, batchId, action: "BATCH_APPROVED", oldValue: { batchStatus: oldStatus }, newValue: { batchStatus: updated.batchStatus } });
    return updated;
  });
}

export async function activateBatch(batchId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.psBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new Error("Batch not found");
    if (batch.batchStatus !== BatchStatus.APPROVED) throw new Error("Only approved batches can be activated");
    if (batch.quantityAvailable <= 0) throw new Error("Batch has no available inventory");
    const updated = await tx.psBatch.update({ where: { id: batchId }, data: { batchStatus: BatchStatus.ACTIVE, activatedAt: new Date(), holdReason: null } });
    await audit(tx, { userId, batchId, action: "BATCH_ACTIVATED", oldValue: { batchStatus: batch.batchStatus }, newValue: { batchStatus: updated.batchStatus } });
    return updated;
  });
}

export async function holdBatch(batchId: string, userId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.psBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new Error("Batch not found");
    if ([BatchStatus.RECALLED, BatchStatus.ARCHIVED, BatchStatus.DEPLETED].includes(batch.batchStatus)) throw new Error("This batch cannot be placed on hold");
    const updated = await tx.psBatch.update({ where: { id: batchId }, data: { batchStatus: BatchStatus.HOLD, holdReason: reason } });
    await audit(tx, { userId, batchId, action: "BATCH_HELD", oldValue: { batchStatus: batch.batchStatus }, newValue: { batchStatus: updated.batchStatus }, reason });
    return updated;
  });
}

export async function releaseHold(batchId: string, userId: string, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.psBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new Error("Batch not found");
    if (batch.batchStatus !== BatchStatus.HOLD) throw new Error("Batch is not on hold");
    const nextStatus = batch.activatedAt ? BatchStatus.ACTIVE : BatchStatus.APPROVED;
    const updated = await tx.psBatch.update({ where: { id: batchId }, data: { batchStatus: nextStatus, holdReason: null } });
    await audit(tx, { userId, batchId, action: "BATCH_HOLD_RELEASED", oldValue: { batchStatus: batch.batchStatus }, newValue: { batchStatus: updated.batchStatus }, reason });
    return updated;
  });
}
