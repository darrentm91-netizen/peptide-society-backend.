import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sha256, verifyShopifyWebhook } from "@/lib/shopify-webhook";
import { confirmFulfillmentQuantity } from "@/services/order-lots";
import { writeOrderLotAssignmentsToShopify } from "@/services/shopify-order-metafield";

type FulfillmentPayload = {
  order_id?: number;
  order_admin_graphql_api_id?: string;
  line_items: Array<{ admin_graphql_api_id: string; quantity: number }>;
};

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyShopifyWebhook(raw, req.headers.get("x-shopify-hmac-sha256"))) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  const eventId = req.headers.get("x-shopify-event-id");
  if (!eventId) return NextResponse.json({ error: "Missing Shopify event ID" }, { status: 400 });
  const claimed = await prisma.webhookEvent.create({ data: { shopifyEventId: eventId, topic: req.headers.get("x-shopify-topic") ?? "fulfillments/create", shopDomain: req.headers.get("x-shopify-shop-domain"), payloadHash: sha256(raw) } }).catch(() => null);
  if (!claimed) return NextResponse.json({ ok: true, duplicate: true });
  try {
    const payload = JSON.parse(raw) as FulfillmentPayload;
    const orderId = payload.order_admin_graphql_api_id ?? (payload.order_id ? `gid://shopify/Order/${payload.order_id}` : null);
    if (!orderId) throw new Error("Fulfillment webhook missing order ID");

    let fulfilled = 0;
    for (const line of payload.line_items) {
      let remaining = line.quantity;
      const assignments = await prisma.orderLotAssignment.findMany({ where: { shopifyOrderId: orderId, shopifyOrderLineId: line.admin_graphql_api_id, status: { in: ["RESERVED", "ASSIGNED"] } }, orderBy: { createdAt: "asc" } });
      for (const assignment of assignments) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, assignment.quantity);
        await confirmFulfillmentQuantity({ assignmentId: assignment.id, quantity: take, userId: "shopify:webhook" });
        remaining -= take;
        fulfilled += take;
      }
      if (remaining > 0) throw new Error(`Fulfillment quantity exceeds reserved lot quantity for line ${line.admin_graphql_api_id}`);
    }
    await writeOrderLotAssignmentsToShopify(orderId);
    await prisma.webhookEvent.update({ where: { shopifyEventId: eventId }, data: { status: "PROCESSED", processedAt: new Date() } });
    return NextResponse.json({ ok: true, fulfilled });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook error";
    await prisma.webhookEvent.update({ where: { shopifyEventId: eventId }, data: { status: "FAILED", errorMessage: message } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
