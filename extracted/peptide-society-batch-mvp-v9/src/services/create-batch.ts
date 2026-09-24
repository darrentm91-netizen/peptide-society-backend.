import { BatchStatus, TestingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildPsLotNumber } from "@/lib/lot-number";
import type { CreateBatchInput } from "@/schemas/create-batch";

function utcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function createBatch(input: CreateBatchInput & { createdByUserId: string }) {
  if (
    input.manufactureDate &&
    input.expirationOrRetestDate &&
    input.expirationOrRetestDate <= input.manufactureDate
  ) {
    throw new Error("Expiration/retest date must be after manufacture date");
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new Error("Product not found");
    if (!product.active) throw new Error("Product is inactive");
    if (!product.batchTrackingEnabled) throw new Error("Batch tracking is disabled for this product");

    const lotDate = utcDateOnly(input.receivedDate ?? new Date());

    const sequence = await tx.batchLotSequence.upsert({
      where: { productId_lotDate: { productId: product.id, lotDate } },
      create: { productId: product.id, lotDate, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
      select: { lastValue: true },
    });

    if (sequence.lastValue > 99) {
      throw new Error("Daily lot sequence exceeded 99 for this product");
    }

    const psLotNumber = buildPsLotNumber(product.lotCode, lotDate, sequence.lastValue);

    const manufacturerBatch = await tx.manufacturerBatch.create({
      data: {
        shipmentId: input.shipmentId ?? null,
        productId: product.id,
        manufacturerLotNumber: input.manufacturerLotNumber,
        quantityReceived: input.quantityReceived,
        manufactureDate: input.manufactureDate ?? null,
        expirationOrRetestDate: input.expirationOrRetestDate ?? null,
      },
    });

    const batch = await tx.psBatch.create({
      data: {
        productId: product.id,
        manufacturerBatchId: manufacturerBatch.id,
        psLotNumber,
        batchStatus: BatchStatus.PENDING_DOCUMENTATION,
        testingStatus: TestingStatus.NOT_STARTED,
        quantityReceived: input.quantityReceived,
        quantityAvailable: input.quantityReceived,
        receivedDate: input.receivedDate ?? new Date(),
        createdByUserId: input.createdByUserId,
      },
    });

    await tx.inventoryTransaction.create({
      data: {
        psBatchId: batch.id,
        transactionType: "RECEIVED",
        quantity: input.quantityReceived,
        reason: "Initial batch receipt",
        createdBy: input.createdByUserId,
      },
    });

    await tx.auditEvent.create({
      data: {
        userId: input.createdByUserId,
        entityType: "PS_BATCH",
        entityId: batch.id,
        psBatchId: batch.id,
        action: "BATCH_CREATED",
        newValueJson: {
          psLotNumber,
          manufacturerLotNumber: input.manufacturerLotNumber,
          quantityReceived: input.quantityReceived,
          batchStatus: BatchStatus.PENDING_DOCUMENTATION,
          testingStatus: TestingStatus.NOT_STARTED,
        },
      },
    });

    return { ...batch, manufacturerLotNumber: manufacturerBatch.manufacturerLotNumber };
  });
}
