import { prisma } from "@/lib/prisma";
import { shopifyGraphql } from "@/lib/shopify";

const PRODUCT_SYNC_QUERY = `#graphql
query PeptideSocietyProducts($first: Int!) {
  products(first: $first, query: "product_type:'Research Compound'") {
    nodes {
      id
      title
      status
      vialTemplate: metafield(namespace: "peptide_society", key: "vial_template") { value }
      batchTracking: metafield(namespace: "peptide_society", key: "batch_tracking_enabled") { value }
      lotCode: metafield(namespace: "peptide_society", key: "lot_code") { value }
      variants(first: 3) {
        nodes { id title sku }
      }
    }
  }
}`;

type SyncResponse = {
  products: {
    nodes: Array<{
      id: string;
      title: string;
      status: string;
      vialTemplate: { value: string } | null;
      batchTracking: { value: string } | null;
      lotCode: { value: string } | null;
      variants: { nodes: Array<{ id: string; title: string; sku: string | null }> };
    }>;
  };
};

function normalizeLotCode(value: string, productName: string): string {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalized) throw new Error(`Lot code is missing for ${productName}`);
  if (normalized.length > 10) throw new Error(`Lot code for ${productName} must be 10 characters or fewer`);
  return normalized;
}

export async function syncShopifyProducts() {
  const data = await shopifyGraphql<SyncResponse>(PRODUCT_SYNC_QUERY, { first: 100 });
  const results = [];

  for (const product of data.products.nodes) {
    if (!product.lotCode?.value) {
      throw new Error(`Shopify product ${product.title} is missing peptide_society.lot_code`);
    }
    if (product.variants.nodes.length !== 1) {
      throw new Error(
        `Shopify product ${product.title} has ${product.variants.nodes.length} variants. ` +
        "Variant-level lot codes must be enabled before syncing multi-variant research products.",
      );
    }

    const variant = product.variants.nodes[0];
    const lotCode = normalizeLotCode(product.lotCode.value, product.title);
    const record = await prisma.product.upsert({
      where: { shopifyProductId: product.id },
      create: {
        shopifyProductId: product.id,
        shopifyVariantId: variant.id,
        sku: variant.sku,
        name: product.title,
        lotCode,
        vialTemplate: product.vialTemplate?.value ?? null,
        batchTrackingEnabled: product.batchTracking?.value !== "false",
        active: product.status !== "ARCHIVED",
      },
      update: {
        shopifyVariantId: variant.id,
        sku: variant.sku,
        name: product.title,
        lotCode,
        vialTemplate: product.vialTemplate?.value ?? null,
        batchTrackingEnabled: product.batchTracking?.value !== "false",
        active: product.status !== "ARCHIVED",
      },
    });
    results.push(record);
  }
  return results;
}
