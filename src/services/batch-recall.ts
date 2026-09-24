import { BatchStatus, LotAssignmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function recallBatch(args: { batchId: string; userId: string; reason: string }) {
  const reason = args.reason.trim();
  if (reason.length < 5) throw new Error("Recall reason must be at least 5 characters");

  return prisma.$transaction(async (tx) => {
    const batch = await tx.psBatch.findUnique({ where: { id: args.batchId } });
    if (!batch) throw new Error("Batch not found");
    if (batch.batchStatus === BatchStatus.RECALLED) throw new Error("Batch is already recalled");
    if (batch.batchStatus === BatchStatus.ARCHIVED) throw new Error("Archived batches cannot be recalled");

    const openAssignments = await tx.orderLotAssignment.findMany({
      where: { psBatchId: args.batchId, status: { in: [LotAssignmentStatus.RESERVED, LotAssignmentStatus.ASSIGNED] } },
    });

    for (const assignment of openAssignments) {
      await tx.psBatch.update({
        where: { id: args.batchId },
        data: { quantityAvailable: { increment: assignment.quantity }, quantityReserved: { decrement: assignment.quantity } },
      });
      await tx.orderLotAssignment.update({ where: { id: assignment.id }, data: { status: LotAssignmentStatus.RELEASED } });
      await tx.inventoryTransaction.create({
        data: {
          psBatchId: args.batchId,
          transactionType: "RESERVATION_RELEASED",
          quantity: assignment.quantity,
          orderId: assignment.shopifyOrderId,
          orderLineId: assignment.shopifyOrderLineId,
          reason: `Batch recall: ${reason}`,
          createdBy: args.userId,
        },
      });
    }

    const updated = await tx.psBatch.update({
      where: { id: args.batchId },
      data: { batchStatus: BatchStatus.RECALLED, recalledReason: reason, recalledAt: new Date(), holdReason: null },
    });

    await tx.auditEvent.create({
      data: {
        userId: args.userId,
        entityType: "PS_BATCH",
        entityId: args.batchId,
        psBatchId: args.batchId,
        action: "BATCH_RECALLED",
        oldValueJson: { batchStatus: batch.batchStatus } as Prisma.InputJsonValue,
        newValueJson: { batchStatus: updated.batchStatus, releasedReservations: openAssignments.length } as Prisma.InputJsonValue,
        reason,
      },
    });

    const impacted = await tx.orderLotAssignment.findMany({
      where: { psBatchId: args.batchId, status: LotAssignmentStatus.FULFILLED },
      select: { shopifyOrderId: true, shopifyOrderLineId: true, quantity: true, fulfilledAt: true },
      orderBy: { fulfilledAt: "asc" },
    });

    return { batch: updated, releasedReservations: openAssignments.length, fulfilledImpactedOrders: impacted };
  });
}

export async function getImpactedOrders(batchId: string) {
  const batch = await prisma.psBatch.findUnique({ where: { id: batchId }, select: { id: true, psLotNumber: true, batchStatus: true, recalledReason: true, recalledAt: true } });
  if (!batch) throw new Error("Batch not found");
  const assignments = await prisma.orderLotAssignment.findMany({
    where: { psBatchId: batchId, status: LotAssignmentStatus.FULFILLED },
    select: { shopifyOrderId: true, shopifyOrderLineId: true, quantity: true, fulfilledAt: true },
    orderBy: [{ shopifyOrderId: "asc" }, { fulfilledAt: "asc" }],
  });
  const byOrder = new Map<string, { shopifyOrderId: string; totalQuantity: number; lines: typeof assignments }>();
  for (const a of assignments) {
    const current = byOrder.get(a.shopifyOrderId) ?? { shopifyOrderId: a.shopifyOrderId, totalQuantity: 0, lines: [] };
    current.totalQuantity += a.quantity;
    current.lines.push(a);
    byOrder.set(a.shopifyOrderId, current);
  }
  return { batch, orderCount: byOrder.size, orders: [...byOrder.values()] };
}
