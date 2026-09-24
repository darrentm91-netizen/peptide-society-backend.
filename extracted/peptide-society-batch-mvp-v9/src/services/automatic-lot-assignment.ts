import { BatchStatus, LotAssignmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AutoAssignLine = {
  shopifyOrderLineId: string;
  shopifyVariantId: string;
  quantity: number;
};

type AssignmentResult = {
  assignmentId: string;
  shopifyOrderLineId: string;
  quantity: number;
  psLotNumber: string;
};

export async function autoReserveOrderLots(args: {
  shopifyOrderId: string;
  lines: AutoAssignLine[];
  actor?: string;
}): Promise<AssignmentResult[]> {
  const actor = args.actor ?? "shopify:webhook";
  const results: AssignmentResult[] = [];

  await prisma.$transaction(async (tx) => {
    for (const line of args.lines) {
      if (line.quantity <= 0) continue;

      const product = await tx.product.findUnique({ where: { shopifyVariantId: line.shopifyVariantId } });
      if (!product || !product.batchTrackingEnabled || !product.active) continue;

      const existing = await tx.orderLotAssignment.findMany({
        where: {
          shopifyOrderId: args.shopifyOrderId,
          shopifyOrderLineId: line.shopifyOrderLineId,
          status: { in: [LotAssignmentStatus.RESERVED, LotAssignmentStatus.ASSIGNED, LotAssignmentStatus.FULFILLED] },
        },
      });
      const alreadyCovered = existing.reduce((sum, a) => sum + a.quantity, 0);
      let remaining = line.quantity - alreadyCovered;
      if (remaining <= 0) continue;

      const batches = await tx.psBatch.findMany({
        where: { productId: product.id, batchStatus: BatchStatus.ACTIVE, quantityAvailable: { gt: 0 } },
        orderBy: [{ activatedAt: "asc" }, { createdAt: "asc" }],
      });

      const totalAvailable = batches.reduce((sum, b) => sum + b.quantityAvailable, 0);
      if (totalAvailable < remaining) {
        throw new Error(`Insufficient active lot inventory for ${product.name}: need ${remaining}, have ${totalAvailable}`);
      }

      for (const batch of batches) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, batch.quantityAvailable);
        const updated = await tx.psBatch.updateMany({
          where: { id: batch.id, batchStatus: BatchStatus.ACTIVE, quantityAvailable: { gte: take } },
          data: { quantityAvailable: { decrement: take }, quantityReserved: { increment: take } },
        });
        if (updated.count !== 1) throw new Error("Lot inventory changed during assignment; retry webhook processing");

        const assignment = await tx.orderLotAssignment.create({
          data: {
            shopifyOrderId: args.shopifyOrderId,
            shopifyOrderLineId: line.shopifyOrderLineId,
            productId: product.id,
            psBatchId: batch.id,
            quantity: take,
            status: LotAssignmentStatus.RESERVED,
            assignedBy: actor,
          },
        });
        await tx.inventoryTransaction.create({
          data: {
            psBatchId: batch.id,
            transactionType: "RESERVED",
            quantity: take,
            orderId: args.shopifyOrderId,
            orderLineId: line.shopifyOrderLineId,
            reason: "Automatic Shopify order reservation",
            createdBy: actor,
          },
        });
        await tx.auditEvent.create({
          data: {
            userId: actor,
            entityType: "ORDER_LOT_ASSIGNMENT",
            entityId: assignment.id,
            psBatchId: batch.id,
            action: "LOT_AUTO_RESERVED",
            newValueJson: { orderId: args.shopifyOrderId, orderLineId: line.shopifyOrderLineId, quantity: take, lot: batch.psLotNumber },
          },
        });
        results.push({ assignmentId: assignment.id, shopifyOrderLineId: line.shopifyOrderLineId, quantity: take, psLotNumber: batch.psLotNumber });
        remaining -= take;
      }
    }
  });

  return results;
}
