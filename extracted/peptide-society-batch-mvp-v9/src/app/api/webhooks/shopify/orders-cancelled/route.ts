import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sha256, verifyShopifyWebhook } from "@/lib/shopify-webhook";
import { releaseReservation } from "@/services/order-lots";
import { writeOrderLotAssignmentsToShopify } from "@/services/shopify-order-metafield";

type OrderPayload = { admin_graphql_api_id: string };

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyShopifyWebhook(raw, req.headers.get("x-shopify-hmac-sha256"))) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  const eventId = req.headers.get("x-shopify-event-id");
  if (!eventId) return NextResponse.json({ error: "Missing Shopify event ID" }, { status: 400 });
  const claimed = await prisma.webhookEvent.create({ data: { shopifyEventId: eventId, topic: req.headers.get("x-shopify-topic") ?? "orders/cancelled", shopDomain: req.headers.get("x-shopify-shop-domain"), payloadHash: sha256(raw) } }).catch(() => null);
  if (!claimed) return NextResponse.json({ ok: true, duplicate: true });
  try {
    const payload = JSON.parse(raw) as OrderPayload;
    const open = await prisma.orderLotAssignment.findMany({ where: { shopifyOrderId: payload.admin_graphql_api_id, status: { in: ["RESERVED", "ASSIGNED"] } } });
    for (const assignment of open) await releaseReservation({ assignmentId: assignment.id, userId: "shopify:webhook", reason: "Shopify order cancelled" });
    if (open.length) await writeOrderLotAssignmentsToShopify(payload.admin_graphql_api_id);
    await prisma.webhookEvent.update({ where: { shopifyEventId: eventId }, data: { status: "PROCESSED", processedAt: new Date() } });
    return NextResponse.json({ ok: true, released: open.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook error";
    await prisma.webhookEvent.update({ where: { shopifyEventId: eventId }, data: { status: "FAILED", errorMessage: message } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
