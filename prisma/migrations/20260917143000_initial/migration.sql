-- Peptide Society initial production schema
CREATE TYPE "BatchStatus" AS ENUM ('PENDING_DOCUMENTATION','PENDING_INDEPENDENT_TESTING','APPROVED','ACTIVE','HOLD','DEPLETED','RECALLED','ARCHIVED');
CREATE TYPE "TestingStatus" AS ENUM ('NOT_STARTED','MANUFACTURER_DOCUMENTED','INDEPENDENT_PENDING','INDEPENDENT_VERIFIED','REVIEW_REQUIRED');
CREATE TYPE "DocumentType" AS ENUM ('MANUFACTURER_COA','INDEPENDENT_COA','IDENTITY_TEST','PURITY_TEST','OTHER');
CREATE TYPE "InventoryTransactionType" AS ENUM ('RECEIVED','RESERVED','RESERVATION_RELEASED','FULFILLED','DAMAGED','LOST','RETURNED','QUARANTINED','MANUAL_ADJUSTMENT');
CREATE TYPE "LotAssignmentStatus" AS ENUM ('RESERVED','ASSIGNED','FULFILLED','CORRECTED','RELEASED');

CREATE TABLE "Product" (
  "id" TEXT NOT NULL,
  "shopifyProductId" TEXT NOT NULL,
  "shopifyVariantId" TEXT,
  "sku" TEXT,
  "name" TEXT NOT NULL,
  "strengthValue" DECIMAL(12,3),
  "strengthUnit" TEXT,
  "lotCode" TEXT NOT NULL,
  "vialTemplate" TEXT,
  "batchTrackingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL,"name" TEXT NOT NULL,"contactName" TEXT,"email" TEXT,"phone" TEXT,"country" TEXT,"status" TEXT NOT NULL DEFAULT 'ACTIVE',"notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Shipment" (
  "id" TEXT NOT NULL,"supplierId" TEXT NOT NULL,"purchaseOrderNumber" TEXT,"shipmentReference" TEXT,"trackingNumber" TEXT,"receivedDate" TIMESTAMP(3),"receivedByUserId" TEXT,"inspectionStatus" TEXT NOT NULL DEFAULT 'PENDING',"notes" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ManufacturerBatch" (
  "id" TEXT NOT NULL,"shipmentId" TEXT,"productId" TEXT NOT NULL,"manufacturerLotNumber" TEXT NOT NULL,"quantityReceived" INTEGER NOT NULL,"manufactureDate" TIMESTAMP(3),"expirationOrRetestDate" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManufacturerBatch_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PsBatch" (
  "id" TEXT NOT NULL,"productId" TEXT NOT NULL,"manufacturerBatchId" TEXT NOT NULL,"psLotNumber" TEXT NOT NULL,
  "batchStatus" "BatchStatus" NOT NULL DEFAULT 'PENDING_DOCUMENTATION',"testingStatus" "TestingStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "quantityReceived" INTEGER NOT NULL,"quantityReserved" INTEGER NOT NULL DEFAULT 0,"quantityFulfilled" INTEGER NOT NULL DEFAULT 0,"quantityAdjusted" INTEGER NOT NULL DEFAULT 0,"quantityQuarantined" INTEGER NOT NULL DEFAULT 0,"quantityAvailable" INTEGER NOT NULL,
  "receivedDate" TIMESTAMP(3),"activatedAt" TIMESTAMP(3),"depletedAt" TIMESTAMP(3),"holdReason" TEXT,"recalledReason" TEXT,"recalledAt" TIMESTAMP(3),"createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PsBatch_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BatchLotSequence" (
  "id" TEXT NOT NULL,"productId" TEXT NOT NULL,"lotDate" DATE NOT NULL,"lastValue" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "BatchLotSequence_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BatchDocument" (
  "id" TEXT NOT NULL,"psBatchId" TEXT NOT NULL,"documentType" "DocumentType" NOT NULL,"versionNumber" INTEGER NOT NULL,"laboratoryName" TEXT,"testDate" TIMESTAMP(3),"purityResult" DECIMAL(8,4),"identityResult" TEXT,"storageUrl" TEXT NOT NULL,"fileName" TEXT NOT NULL,"mimeType" TEXT,"fileSizeBytes" INTEGER,"publicVisible" BOOLEAN NOT NULL DEFAULT false,"approved" BOOLEAN NOT NULL DEFAULT false,"approvedBy" TEXT,"approvedAt" TIMESTAMP(3),"supersededAt" TIMESTAMP(3),"createdBy" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BatchDocument_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BatchQrCode" (
  "id" TEXT NOT NULL,"psBatchId" TEXT NOT NULL,"verificationToken" TEXT NOT NULL,"verificationUrl" TEXT NOT NULL,"active" BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"revokedAt" TIMESTAMP(3),
  CONSTRAINT "BatchQrCode_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OrderLotAssignment" (
  "id" TEXT NOT NULL,"shopifyOrderId" TEXT NOT NULL,"shopifyOrderLineId" TEXT NOT NULL,"productId" TEXT NOT NULL,"psBatchId" TEXT NOT NULL,"quantity" INTEGER NOT NULL,"quantityReturned" INTEGER NOT NULL DEFAULT 0,"status" "LotAssignmentStatus" NOT NULL DEFAULT 'RESERVED',"assignedBy" TEXT NOT NULL,"assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"fulfilledAt" TIMESTAMP(3),"correctedFromId" TEXT,"correctionReason" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderLotAssignment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "InventoryTransaction" (
  "id" TEXT NOT NULL,"psBatchId" TEXT NOT NULL,"transactionType" "InventoryTransactionType" NOT NULL,"quantity" INTEGER NOT NULL,"orderId" TEXT,"orderLineId" TEXT,"reason" TEXT,"notes" TEXT,"createdBy" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,"userId" TEXT NOT NULL,"entityType" TEXT NOT NULL,"entityId" TEXT NOT NULL,"action" TEXT NOT NULL,"oldValueJson" JSONB,"newValueJson" JSONB,"reason" TEXT,"ipAddress" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"psBatchId" TEXT,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,"shopifyEventId" TEXT NOT NULL,"topic" TEXT NOT NULL,"shopDomain" TEXT,"payloadHash" TEXT,"status" TEXT NOT NULL DEFAULT 'RECEIVED',"errorMessage" TEXT,"processedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Product_shopifyProductId_key" ON "Product"("shopifyProductId");
CREATE UNIQUE INDEX "Product_shopifyVariantId_key" ON "Product"("shopifyVariantId");
CREATE UNIQUE INDEX "Product_lotCode_key" ON "Product"("lotCode");
CREATE UNIQUE INDEX "ManufacturerBatch_productId_manufacturerLotNumber_key" ON "ManufacturerBatch"("productId","manufacturerLotNumber");
CREATE UNIQUE INDEX "PsBatch_psLotNumber_key" ON "PsBatch"("psLotNumber");
CREATE INDEX "PsBatch_productId_batchStatus_idx" ON "PsBatch"("productId","batchStatus");
CREATE INDEX "PsBatch_batchStatus_testingStatus_idx" ON "PsBatch"("batchStatus","testingStatus");
CREATE UNIQUE INDEX "BatchLotSequence_productId_lotDate_key" ON "BatchLotSequence"("productId","lotDate");
CREATE UNIQUE INDEX "BatchDocument_psBatchId_documentType_versionNumber_key" ON "BatchDocument"("psBatchId","documentType","versionNumber");
CREATE INDEX "BatchDocument_psBatchId_documentType_approved_idx" ON "BatchDocument"("psBatchId","documentType","approved");
CREATE UNIQUE INDEX "BatchQrCode_verificationToken_key" ON "BatchQrCode"("verificationToken");
CREATE INDEX "BatchQrCode_psBatchId_active_idx" ON "BatchQrCode"("psBatchId","active");
CREATE INDEX "OrderLotAssignment_shopifyOrderId_shopifyOrderLineId_idx" ON "OrderLotAssignment"("shopifyOrderId","shopifyOrderLineId");
CREATE INDEX "OrderLotAssignment_psBatchId_status_idx" ON "OrderLotAssignment"("psBatchId","status");
CREATE UNIQUE INDEX "WebhookEvent_shopifyEventId_key" ON "WebhookEvent"("shopifyEventId");
CREATE INDEX "WebhookEvent_topic_status_idx" ON "WebhookEvent"("topic","status");

ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManufacturerBatch" ADD CONSTRAINT "ManufacturerBatch_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManufacturerBatch" ADD CONSTRAINT "ManufacturerBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PsBatch" ADD CONSTRAINT "PsBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PsBatch" ADD CONSTRAINT "PsBatch_manufacturerBatchId_fkey" FOREIGN KEY ("manufacturerBatchId") REFERENCES "ManufacturerBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BatchLotSequence" ADD CONSTRAINT "BatchLotSequence_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BatchDocument" ADD CONSTRAINT "BatchDocument_psBatchId_fkey" FOREIGN KEY ("psBatchId") REFERENCES "PsBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BatchQrCode" ADD CONSTRAINT "BatchQrCode_psBatchId_fkey" FOREIGN KEY ("psBatchId") REFERENCES "PsBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderLotAssignment" ADD CONSTRAINT "OrderLotAssignment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderLotAssignment" ADD CONSTRAINT "OrderLotAssignment_psBatchId_fkey" FOREIGN KEY ("psBatchId") REFERENCES "PsBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_psBatchId_fkey" FOREIGN KEY ("psBatchId") REFERENCES "PsBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_psBatchId_fkey" FOREIGN KEY ("psBatchId") REFERENCES "PsBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
