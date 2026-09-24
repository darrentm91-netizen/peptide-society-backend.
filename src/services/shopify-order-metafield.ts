import { shopifyGraphql } from "@/lib/shopify";
import { prisma } from "@/lib/prisma";

const SET_ORDER_LOTS = `#graphql
mutation SetOrderLotAssignments($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { id namespace key value }
    userErrors { field message }
  }
}`;

type SetResponse = {
  metafieldsSet: {
    metafields: Array<{ id: string; namespace: string; key: string; value: string }>;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
};

export async function writeOrderLotAssignmentsToShopify(shopifyOrderId: string) {
  const assignments = await prisma.orderLotAssignment.findMany({
    where: { shopifyOrderId, status: { in: ["RESERVED", "ASSIGNED", "FULFILLED"] } },
    include: { psBatch: true },
    orderBy: { createdAt: "asc" },
  });

  const payload = assignments.map((a) => ({
    line_item_id: a.shopifyOrderLineId,
    lot: a.psBatch.psLotNumber,
    quantity: a.quantity,
    quantity_returned: a.quantityReturned,
    status: a.status,
  }));

  const data = await shopifyGraphql<SetResponse>(SET_ORDER_LOTS, {
    metafields: [{ ownerId: shopifyOrderId, namespace: "peptide_society", key: "lot_assignments", type: "json", value: JSON.stringify(payload) }],
  });
  if (data.metafieldsSet.userErrors.length) throw new Error(data.metafieldsSet.userErrors.map((e) => e.message).join("; "));
  return payload;
}
