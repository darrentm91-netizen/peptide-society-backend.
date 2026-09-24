import { BatchStatus, LotAssignmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function reserveLot(args: { orderId: string; orderLineId: string; productId: string; psBatchId: string; quantity: number; userId: string }) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.psBatch.findUnique({ where: { id: args.psBatchId } });
    if (!batch) throw new Error("Batch not found");
    if (batch.productId !== args.productId) throw new Error("Batch does not belong to the selected product");
    if (batch.batchStatus !== BatchStatus.ACTIVE) throw new Error("Only active batches can be reserved");
    if (batch.quantityAvailable < args.quantity) throw new Error("Insufficient available lot inventory");

    const updated = await tx.psBatch.updateMany({
      where: { id: batch.id, batchStatus: BatchStatus.ACTIVE, quantityAvailable: { gte: args.quantity } },
      data: { quantityAvailable: { decrement: args.quantity }, quantityReserved: { increment: args.quantity } },
    });
    if (updated.count !== 1) throw new Error("Inventory changed; retry the reservation");

    const assignment = await tx.orderLotAssignment.create({ data: { shopifyOrderId: args.orderId, shopifyOrderLineId: args.orderLineId, productId: args.productId, psBatchId: args.psBatchId, quantity: args.quantity, assignedBy: args.userId } });
    await tx.inventoryTransaction.create({ data: { psBatchId: args.psBatchId, transactionType: "RESERVED", quantity: args.quantity, orderId: args.orderId, orderLineId: args.orderLineId, createdBy: args.userId, reason: "Order lot reservation" } });
    await tx.auditEvent.create({ data: { userId: args.userId, entityType: "ORDER_LOT_ASSIGNMENT", entityId: assignment.id, psBatchId: args.psBatchId, action: "LOT_RESERVED", newValueJson: { orderId: args.orderId, orderLineId: args.orderLineId, quantity: args.quantity } } });
    return assignment;
  });
}

export async function releaseReservation(args: { assignmentId: string; userId: string; reason: string }) {
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.orderLotAssignment.findUnique({ where: { id: args.assignmentId } });
    if (!assignment) throw new Error("Lot assignment not found");
    if (![LotAssignmentStatus.RESERVED, LotAssignmentStatus.ASSIGNED].includes(assignment.status)) throw new Error("Only open reservations can be released");
    await tx.psBatch.update({ where: { id: assignment.psBatchId }, data: { quantityAvailable: { increment: assignment.quantity }, quantityReserved: { decrement: assignment.quantity } } });
    const updated = await tx.orderLotAssignment.update({ where: { id: assignment.id }, data: { status: LotAssignmentStatus.RELEASED } });
    await tx.inventoryTransaction.create({ data: { psBatchId: assignment.psBatchId, transactionType: "RESERVATION_RELEASED", quantity: assignment.quantity, orderId: assignment.shopifyOrderId, orderLineId: assignment.shopifyOrderLineId, createdBy: args.userId, reason: args.reason } });
    await tx.auditEvent.create({ data: { userId: args.userId, entityType: "ORDER_LOT_ASSIGNMENT", entityId: assignment.id, psBatchId: assignment.psBatchId, action: "RESERVATION_RELEASED", reason: args.reason } });
    return updated;
  });
}

export async function confirmFulfillment(args: { assignmentId: string; userId: string }) {
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.orderLotAssignment.findUnique({ where: { id: args.assignmentId } });
    if (!assignment) throw new Error("Lot assignment not found");
    if (![LotAssignmentStatus.RESERVED, LotAssignmentStatus.ASSIGNED].includes(assignment.status)) throw new Error("Lot assignment cannot be fulfilled in its current state");
    await tx.psBatch.update({ where: { id: assignment.psBatchId }, data: { quantityReserved: { decrement: assignment.quantity }, quantityFulfilled: { increment: assignment.quantity } } });
    const updated = await tx.orderLotAssignment.update({ where: { id: assignment.id }, data: { status: LotAssignmentStatus.FULFILLED, fulfilledAt: new Date() } });
    await tx.inventoryTransaction.create({ data: { psBatchId: assignment.psBatchId, transactionType: "FULFILLED", quantity: assignment.quantity, orderId: assignment.shopifyOrderId, orderLineId: assignment.shopifyOrderLineId, createdBy: args.userId, reason: "Order fulfillment confirmed" } });
    await tx.auditEvent.create({ data: { userId: args.userId, entityType: "ORDER_LOT_ASSIGNMENT", entityId: assignment.id, psBatchId: assignment.psBatchId, action: "LOT_FULFILLED", newValueJson: { quantity: assignment.quantity } } });
    const remaining = await tx.psBatch.findUnique({ where: { id: assignment.psBatchId } });
    if (remaining && remaining.quantityAvailable === 0 && remaining.quantityReserved === 0) {
      await tx.psBatch.update({ where: { id: remaining.id }, data: { batchStatus: BatchStatus.DEPLETED, depletedAt: new Date() } });
    }
    return updated;
  });
}

export async function confirmFulfillmentQuantity(args: { assignmentId: string; quantity: number; userId: string }) {
  if (args.quantity <= 0) throw new Error("Fulfillment quantity must be greater than zero");

  return prisma.$transaction(async (tx) => {
    const assignment = await tx.orderLotAssignment.findUnique({ where: { id: args.assignmentId } });
    if (!assignment) throw new Error("Lot assignment not found");
    if (![LotAssignmentStatus.RESERVED, LotAssignmentStatus.ASSIGNED].includes(assignment.status)) throw new Error("Lot assignment cannot be fulfilled in its current state");
    if (args.quantity > assignment.quantity) throw new Error("Fulfillment quantity exceeds reserved lot quantity");

    await tx.psBatch.update({
      where: { id: assignment.psBatchId },
      data: { quantityReserved: { decrement: args.quantity }, quantityFulfilled: { increment: args.quantity } },
    });

    let fulfilledAssignment;
    if (args.quantity === assignment.quantity) {
      fulfilledAssignment = await tx.orderLotAssignment.update({
        where: { id: assignment.id },
        data: { status: LotAssignmentStatus.FULFILLED, fulfilledAt: new Date() },
      });
    } else {
      await tx.orderLotAssignment.update({ where: { id: assignment.id }, data: { quantity: { decrement: args.quantity } } });
      fulfilledAssignment = await tx.orderLotAssignment.create({
        data: {
          shopifyOrderId: assignment.shopifyOrderId,
          shopifyOrderLineId: assignment.shopifyOrderLineId,
          productId: assignment.productId,
          psBatchId: assignment.psBatchId,
          quantity: args.quantity,
          status: LotAssignmentStatus.FULFILLED,
          assignedBy: assignment.assignedBy,
          assignedAt: assignment.assignedAt,
          fulfilledAt: new Date(),
        },
      });
    }

    await tx.inventoryTransaction.create({
      data: {
        psBatchId: assignment.psBatchId,
        transactionType: "FULFILLED",
        quantity: args.quantity,
        orderId: assignment.shopifyOrderId,
        orderLineId: assignment.shopifyOrderLineId,
        createdBy: args.userId,
        reason: "Shopify partial/full fulfillment confirmed",
      },
    });
    await tx.auditEvent.create({
      data: {
        userId: args.userId,
        entityType: "ORDER_LOT_ASSIGNMENT",
        entityId: fulfilledAssignment.id,
        psBatchId: assignment.psBatchId,
        action: args.quantity === assignment.quantity ? "LOT_FULFILLED" : "LOT_PARTIALLY_FULFILLED",
        newValueJson: { quantity: args.quantity },
      },
    });

    const remaining = await tx.psBatch.findUnique({ where: { id: assignment.psBatchId } });
    if (remaining && remaining.quantityAvailable === 0 && remaining.quantityReserved === 0) {
      await tx.psBatch.update({ where: { id: remaining.id }, data: { batchStatus: BatchStatus.DEPLETED, depletedAt: new Date() } });
    }
    return fulfilledAssignment;
  });
}

export async function quarantineReturnedQuantity(args: {
  assignmentId: string;
  quantity: number;
  userId: string;
  reason: string;
}) {
  if (!Number.isInteger(args.quantity) || args.quantity <= 0) throw new Error("Return quantity must be a positive whole number");
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.orderLotAssignment.findUnique({ where: { id: args.assignmentId }, include: { psBatch: true } });
    if (!assignment) throw new Error("Lot assignment not found");
    if (assignment.status !== LotAssignmentStatus.FULFILLED) throw new Error("Only fulfilled lot assignments can be returned");
    const remainingReturnable = assignment.quantity - assignment.quantityReturned;
    if (args.quantity > remainingReturnable) throw new Error(`Return quantity exceeds remaining returnable quantity (${remainingReturnable})`);

    const updatedAssignment = await tx.orderLotAssignment.update({
      where: { id: assignment.id },
      data: { quantityReturned: { increment: args.quantity } },
    });
    await tx.psBatch.update({ where: { id: assignment.psBatchId }, data: { quantityQuarantined: { increment: args.quantity } } });
    await tx.inventoryTransaction.create({
      data: {
        psBatchId: assignment.psBatchId,
        transactionType: "RETURNED",
        quantity: args.quantity,
        orderId: assignment.shopifyOrderId,
        orderLineId: assignment.shopifyOrderLineId,
        reason: args.reason,
        notes: "Customer return received into quarantine; not returned to sellable inventory",
        createdBy: args.userId,
      },
    });
    await tx.auditEvent.create({
      data: {
        userId: args.userId,
        entityType: "ORDER_LOT_ASSIGNMENT",
        entityId: assignment.id,
        psBatchId: assignment.psBatchId,
        action: "RETURN_QUARANTINED",
        oldValueJson: { quantityReturned: assignment.quantityReturned },
        newValueJson: { quantityReturned: updatedAssignment.quantityReturned, returnedNow: args.quantity },
        reason: args.reason,
      },
    });
    return updatedAssignment;
  });
}

export async function correctFulfilledLotAssignment(args: {
  assignmentId: string;
  targetBatchId: string;
  userId: string;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.orderLotAssignment.findUnique({ where: { id: args.assignmentId }, include: { psBatch: true, product: true } });
    if (!assignment) throw new Error("Lot assignment not found");
    if (assignment.status !== LotAssignmentStatus.FULFILLED) throw new Error("Only fulfilled assignments can be corrected");
    if (assignment.quantityReturned > 0) throw new Error("A returned assignment cannot be lot-corrected; resolve the return audit trail first");
    if (assignment.psBatchId === args.targetBatchId) throw new Error("Target lot is already assigned");

    const target = await tx.psBatch.findUnique({ where: { id: args.targetBatchId } });
    if (!target) throw new Error("Target batch not found");
    if (target.productId !== assignment.productId) throw new Error("Target batch belongs to a different product");
    if (target.batchStatus !== BatchStatus.ACTIVE) throw new Error(`Target batch must be active; current status is ${target.batchStatus.toLowerCase()}`);
    if (target.quantityAvailable < assignment.quantity) throw new Error("Target batch does not have enough available inventory for this correction");

    // Reverse the erroneous fulfilled consumption from the old lot. If that lot had been
    // depleted, reopen it into HOLD so an operator must review it before it can sell again.
    const oldWasDepleted = assignment.psBatch.batchStatus === BatchStatus.DEPLETED;
    await tx.psBatch.update({
      where: { id: assignment.psBatchId },
      data: {
        quantityFulfilled: { decrement: assignment.quantity },
        quantityAvailable: { increment: assignment.quantity },
        ...(oldWasDepleted ? { batchStatus: BatchStatus.HOLD, depletedAt: null, holdReason: "Reopened by fulfilled lot correction; review inventory before release" } : {}),
      },
    });

    const targetUpdate = await tx.psBatch.updateMany({
      where: { id: target.id, batchStatus: BatchStatus.ACTIVE, quantityAvailable: { gte: assignment.quantity } },
      data: { quantityAvailable: { decrement: assignment.quantity }, quantityFulfilled: { increment: assignment.quantity } },
    });
    if (targetUpdate.count !== 1) throw new Error("Target lot inventory/status changed; retry the correction");
    await tx.orderLotAssignment.update({
      where: { id: assignment.id },
      data: { status: LotAssignmentStatus.CORRECTED, correctionReason: args.reason },
    });
    const corrected = await tx.orderLotAssignment.create({
      data: {
        shopifyOrderId: assignment.shopifyOrderId,
        shopifyOrderLineId: assignment.shopifyOrderLineId,
        productId: assignment.productId,
        psBatchId: target.id,
        quantity: assignment.quantity,
        status: LotAssignmentStatus.FULFILLED,
        assignedBy: args.userId,
        assignedAt: new Date(),
        fulfilledAt: assignment.fulfilledAt ?? new Date(),
        correctedFromId: assignment.id,
        correctionReason: args.reason,
      },
    });
    await tx.inventoryTransaction.createMany({ data: [
      { psBatchId: assignment.psBatchId, transactionType: "MANUAL_ADJUSTMENT", quantity: assignment.quantity, orderId: assignment.shopifyOrderId, orderLineId: assignment.shopifyOrderLineId, reason: `Lot correction reversal: ${args.reason}`, createdBy: args.userId },
      { psBatchId: target.id, transactionType: "MANUAL_ADJUSTMENT", quantity: assignment.quantity, orderId: assignment.shopifyOrderId, orderLineId: assignment.shopifyOrderLineId, reason: `Lot correction fulfillment: ${args.reason}`, createdBy: args.userId },
    ] });
    await tx.auditEvent.createMany({ data: [
      { userId: args.userId, entityType: "ORDER_LOT_ASSIGNMENT", entityId: assignment.id, psBatchId: assignment.psBatchId, action: "FULFILLED_LOT_CORRECTED_FROM", oldValueJson: { psBatchId: assignment.psBatchId, quantity: assignment.quantity }, newValueJson: { targetBatchId: target.id }, reason: args.reason },
      { userId: args.userId, entityType: "ORDER_LOT_ASSIGNMENT", entityId: corrected.id, psBatchId: target.id, action: "FULFILLED_LOT_CORRECTED_TO", oldValueJson: { correctedFromId: assignment.id }, newValueJson: { psBatchId: target.id, quantity: assignment.quantity }, reason: args.reason },
    ] });

    const targetAfter = await tx.psBatch.findUnique({ where: { id: target.id } });
    if (targetAfter && targetAfter.quantityAvailable === 0 && targetAfter.quantityReserved === 0 && targetAfter.batchStatus === BatchStatus.ACTIVE) {
      await tx.psBatch.update({ where: { id: target.id }, data: { batchStatus: BatchStatus.DEPLETED, depletedAt: new Date() } });
    }
    return corrected;
  });
}
