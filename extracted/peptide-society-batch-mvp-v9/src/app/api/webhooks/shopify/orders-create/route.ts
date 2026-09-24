import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sha256, verifyShopifyWebhook } from "@/lib/shopify-webhook";
import { autoReserveOrderLots } from "@/services/automatic-lot-assignment";
import { writeOrderLotAssignmentsToShopify } from "@/services/shopify-order-metafield";

type OrderCreatePayload = {
  admin_graphql_api_id: string;
  line_items: Array<{ admin_graphql_api_id: string; variant_id?: number | null; variant_admin_graphql_api_id?: string | null; quantity: number }>;
};

function variantGid(line: OrderCreatePayload["line_items"][number]) {
  if (line.variant_admin_graphql_api_id) return line.variant_admin_graphql_api_id;
  return line.variant_id ? `gid://shopify/ProductVariant/${line.variant_id}` : null;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyShopifyWebhook(raw, req.headers.get("x-shopify-hmac-sha256"))) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  const eventId = req.headers.get("x-shopify-event-id");
  if (!eventId) return NextResponse.json({ error: "Missing Shopify event ID" }, { status: 400 });
  const topic = req.headers.get("x-shopify-topic") ?? "orders/create";
  const shop = req.headers.get("x-shopify-shop-domain");

  const claimed = await prisma.webhookEvent.create({ data: { shopifyEventId: eventId, topic, shopDomain: shop, payloadHash: sha256(raw) } }).catch(() => null);
  if (!claimed) return NextResponse.json({ ok: true, duplicate: true });

  try {
    const payload = JSON.parse(raw) as OrderCreatePayload;
    const lines = payload.line_items.flatMap((line) => {
      const gid = variantGid(line);
      return gid ? [{ shopifyOrderLineId: line.admin_graphql_api_id, shopifyVariantId: gid, quantity: line.quantity }] : [];
    });
    const assignments = await autoReserveOrderLots({ shopifyOrderId: payload.admin_graphql_api_id, lines });
    if (assignments.length) await writeOrderLotAssignmentsToShopify(payload.admin_graphql_api_id);
    await prisma.webhookEvent.update({ where: { shopifyEventId: eventId }, data: { status: "PROCESSED", processedAt: new Date() } });
    return NextResponse.json({ ok: true, assignments: assignments.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook error";
    await prisma.webhookEvent.update({ where: { shopifyEventId: eventId }, data: { status: "FAILED", errorMessage: message } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
