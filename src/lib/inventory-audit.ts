import { LotAssignmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type InventoryViolation = {
  batchId: string;
  lotNumber: string;
  code: string;
  message: string;
};

export async function auditInventoryInvariants(): Promise<InventoryViolation[]> {
  const batches = await prisma.psBatch.findMany({
    select: {
      id: true,
      psLotNumber: true,
      quantityReceived: true,
      quantityAdjusted: true,
      quantityAvailable: true,
      quantityReserved: true,
      quantityFulfilled: true,
      quantityQuarantined: true,
      lotAssignments: { select: { quantity: true, quantityReturned: true, status: true } },
    },
  });

  const violations: InventoryViolation[] = [];
  for (const batch of batches) {
    const counters = [batch.quantityReceived, batch.quantityAvailable, batch.quantityReserved, batch.quantityFulfilled, batch.quantityQuarantined];
    if (counters.some((value) => value < 0)) {
      violations.push({ batchId: batch.id, lotNumber: batch.psLotNumber, code: "NEGATIVE_COUNTER", message: "One or more inventory counters are negative." });
    }
    if (batch.quantityQuarantined > batch.quantityFulfilled) {
      violations.push({ batchId: batch.id, lotNumber: batch.psLotNumber, code: "QUARANTINE_EXCEEDS_FULFILLED", message: "Quarantined returned quantity exceeds cumulative fulfilled quantity." });
    }

    const reservedFromAssignments = batch.lotAssignments
      .filter((a) => [LotAssignmentStatus.RESERVED, LotAssignmentStatus.ASSIGNED].includes(a.status))
      .reduce((sum, a) => sum + a.quantity, 0);
    const fulfilledFromAssignments = batch.lotAssignments
      .filter((a) => a.status === LotAssignmentStatus.FULFILLED)
      .reduce((sum, a) => sum + a.quantity, 0);

    if (reservedFromAssignments !== batch.quantityReserved) {
      violations.push({ batchId: batch.id, lotNumber: batch.psLotNumber, code: "RESERVED_MISMATCH", message: `Batch reserved=${batch.quantityReserved}, assignments reserved=${reservedFromAssignments}.` });
    }
    if (fulfilledFromAssignments !== batch.quantityFulfilled) {
      violations.push({ batchId: batch.id, lotNumber: batch.psLotNumber, code: "FULFILLED_MISMATCH", message: `Batch fulfilled=${batch.quantityFulfilled}, assignments fulfilled=${fulfilledFromAssignments}.` });
    }

    const returnedFromAssignments = batch.lotAssignments
      .filter((a) => a.status === LotAssignmentStatus.FULFILLED)
      .reduce((sum, a) => sum + a.quantityReturned, 0);
    if (returnedFromAssignments !== batch.quantityQuarantined) {
      violations.push({ batchId: batch.id, lotNumber: batch.psLotNumber, code: "QUARANTINE_MISMATCH", message: `Batch quarantined=${batch.quantityQuarantined}, assignment returns=${returnedFromAssignments}.` });
    }

    for (const assignment of batch.lotAssignments) {
      if (assignment.quantityReturned < 0 || assignment.quantityReturned > assignment.quantity) {
        violations.push({ batchId: batch.id, lotNumber: batch.psLotNumber, code: "INVALID_RETURN_QUANTITY", message: "An assignment has an invalid returned quantity." });
        break;
      }
    }

    // quantityAdjusted is the signed net physical inventory adjustment. Returned units stay
    // part of cumulative fulfilled quantity and are tracked separately as quarantined.
    const expectedOnLedger = batch.quantityReceived + batch.quantityAdjusted;
    const accounted = batch.quantityAvailable + batch.quantityReserved + batch.quantityFulfilled;
    if (expectedOnLedger !== accounted) {
      violations.push({ batchId: batch.id, lotNumber: batch.psLotNumber, code: "LEDGER_BALANCE_MISMATCH", message: `Received+adjusted=${expectedOnLedger}, available+reserved+fulfilled=${accounted}.` });
    }
  }
  return violations;
}
