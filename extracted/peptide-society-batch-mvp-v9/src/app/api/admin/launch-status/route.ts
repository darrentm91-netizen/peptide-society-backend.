import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";
import { documentStorageReadiness } from "@/lib/document-storage";
import { auditInventoryInvariants } from "@/lib/inventory-audit";

export async function GET(request: Request) {
  const admin = requireAdmin(request);
  if (isAuthResponse(admin)) return admin;

  const [
    productCount,
    activeProducts,
    batchCount,
    activeBatches,
    recalledBatches,
    blockedBatches,
    approvedPublicDocuments,
    unapprovedDocuments,
    reservedAssignments,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { active: true } }),
    prisma.psBatch.count(),
    prisma.psBatch.count({ where: { batchStatus: "ACTIVE" } }),
    prisma.psBatch.count({ where: { batchStatus: "RECALLED" } }),
    prisma.psBatch.count({ where: { batchStatus: { in: ["PENDING_DOCUMENTATION", "PENDING_INDEPENDENT_TESTING", "HOLD"] } } }),
    prisma.batchDocument.count({ where: { approved: true, publicVisible: true, supersededAt: null } }),
    prisma.batchDocument.count({ where: { approved: false } }),
    prisma.orderLotAssignment.count({ where: { status: "RESERVED" } }),
  ]);

  const inventoryViolations = await auditInventoryInvariants();

  let storage: ReturnType<typeof documentStorageReadiness> | { ready: false; mode: string; error: string };
  try {
    storage = documentStorageReadiness();
  } catch (error) {
    storage = {
      ready: false,
      mode: process.env.DOCUMENT_STORAGE_MODE || "local",
      error: error instanceof Error ? error.message : "Storage configuration invalid",
    };
  }

  const technicalBlockers: string[] = [];
  if (!process.env.DATABASE_URL) technicalBlockers.push("DATABASE_URL missing");
  if (!process.env.SHOPIFY_SHOP) technicalBlockers.push("SHOPIFY_SHOP missing");
  if (!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN) technicalBlockers.push("SHOPIFY_ADMIN_ACCESS_TOKEN missing");
  if (!process.env.SHOPIFY_WEBHOOK_SECRET) technicalBlockers.push("SHOPIFY_WEBHOOK_SECRET missing");
  if (!process.env.PUBLIC_VERIFY_BASE_URL) technicalBlockers.push("PUBLIC_VERIFY_BASE_URL missing");
  if (!process.env.APP_BASE_URL) technicalBlockers.push("APP_BASE_URL missing");
  if (!process.env.PUBLIC_STOREFRONT_ORIGINS) technicalBlockers.push("PUBLIC_STOREFRONT_ORIGINS missing");
  if (inventoryViolations.length > 0) technicalBlockers.push(`${inventoryViolations.length} inventory invariant violation(s) require resolution`);
  if (!storage.ready) technicalBlockers.push("Document storage is not production ready");

  const dataBlockers: string[] = [];
  if (productCount === 0) dataBlockers.push("No products synced into the batch database");
  if (activeBatches === 0) dataBlockers.push("No Active batches are available for fulfillment");
  if (blockedBatches > 0) dataBlockers.push(`${blockedBatches} batch(es) still pending or on hold`);
  if (unapprovedDocuments > 0) dataBlockers.push(`${unapprovedDocuments} document(s) still awaiting approval`);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    actor: admin.userId,
    launchTarget: "2026-10-15",
    technicalReady: technicalBlockers.length === 0,
    inventoryReady: activeBatches > 0 && unapprovedDocuments === 0,
    counts: {
      products: productCount,
      activeProducts,
      batches: batchCount,
      activeBatches,
      recalledBatches,
      blockedBatches,
      approvedPublicDocuments,
      unapprovedDocuments,
      reservedAssignments,
      inventoryInvariantViolations: inventoryViolations.length,
    },
    storage,
    inventoryAudit: { healthy: inventoryViolations.length === 0, violations: inventoryViolations },
    blockers: {
      technical: technicalBlockers,
      data: dataBlockers,
      external: [
        "Legal/compliance approval for each sellable product",
        "Payment processor approval for the intended catalog",
        "Shipping/returns/privacy/terms finalized",
        "Real supplier and testing documentation loaded and reviewed",
      ],
    },
  });
}
