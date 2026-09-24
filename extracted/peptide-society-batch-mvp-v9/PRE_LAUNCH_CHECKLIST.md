# Peptide Society — October 15 Pre-Launch Checklist

Target controlled launch: **October 15, 2026**

A checked box means evidence exists, not merely that the task was discussed.

## 1. Product / legal release
- [ ] Each product intended for launch has legal/compliance approval for the exact identity, labeling, claims, and intended research-use positioning.
- [ ] No product is being renamed or described in a way that obscures its actual scientific identity.
- [ ] Retatrutide remains unpublished unless specifically cleared.
- [ ] Final strength, SKU, label, vial format, and supplier identity match source documentation.
- [ ] Store copy contains no dosing, administration, treatment, or human-use instructions.

## 2. Supplier / batch evidence
- [ ] Supplier record created for each incoming shipment.
- [ ] Manufacturer lot number captured exactly.
- [ ] Quantity received reconciled to shipment.
- [ ] Manufacturer COA uploaded for each sellable batch.
- [ ] Required independent testing uploaded and reviewed.
- [ ] Documents are versioned; superseded files remain retained internally.
- [ ] No document is reused for a different manufacturer lot.
- [ ] Each sellable batch reaches APPROVED before ACTIVE.

## 3. Traceability / QR
- [ ] PS lot generated from stable Shopify lot code.
- [ ] QR created for every launch batch.
- [ ] QR resolves to the exact lot record.
- [ ] Public verification shows only approved/current/public documents.
- [ ] Depleted batches remain verifiable.
- [ ] Hold and recall statuses are reflected publicly.

## 4. Shopify catalog
- [ ] Actual strengths and variants confirmed.
- [ ] Actual prices entered; no $0 placeholders remain on published products.
- [ ] Product images correspond to the actual container/vial sold.
- [ ] Batch Tracking Enabled is true for all tracked products.
- [ ] Product Information / Research Background / Research References / Storage & Handling reviewed.
- [ ] Navigation, footer, product pages, verification, COA page, and Research Library reviewed on mobile and desktop.
- [ ] Only launch-approved products changed from DRAFT to intended published state.

## 5. Payments / policies / customer operations
- [ ] Payment processor has approved the intended catalog and business model.
- [ ] Test transaction completed through the actual processor.
- [ ] Shipping zones, rates, fulfillment timing, and carrier workflow finalized.
- [ ] Returns/refunds policy finalized.
- [ ] Privacy policy, terms, contact details, and required disclosures finalized.
- [ ] Support inbox is active and monitored.

## 6. Production infrastructure
- [ ] Production host connected and deployed.
- [ ] PostgreSQL provisioned with backups.
- [ ] Private S3-compatible document storage configured.
- [ ] HTTPS enabled.
- [ ] Admin app restricted to authorized operators.
- [ ] Production secrets set outside source control.
- [ ] `npm run prisma:migrate:deploy` passes.
- [ ] `npm run preflight` passes in production.
- [ ] `/api/health` returns healthy.
- [ ] `/api/readiness` returns ready.

## 7. Shopify integration
- [ ] Shopify Admin credentials configured in backend.
- [ ] Shopify webhook secret configured.
- [ ] `orders/create` webhook registered and tested.
- [ ] `orders/cancelled` webhook registered and tested.
- [ ] `fulfillments/create` webhook registered and tested.
- [ ] Duplicate webhook delivery does not duplicate reservations.
- [ ] Exact lot assignment is written to Shopify order metafield.

## 8. End-to-end QA
- [ ] Create Batch with a real launch product.
- [ ] Upload manufacturer COA.
- [ ] Upload independent test where required.
- [ ] Approve documents.
- [ ] Approve batch.
- [ ] Activate batch.
- [ ] Verify QR/public lot page.
- [ ] Place a paid test order.
- [ ] Confirm automatic lot reservation.
- [ ] Partially fulfill an order and verify quantities.
- [ ] Complete fulfillment and verify exact lot on order/customer history.
- [ ] Cancel a separate test order and verify reservation release.
- [ ] Place a test batch on HOLD and confirm it cannot fulfill new orders.
- [ ] Perform recall drill and verify impacted-order query/public status.

## 9. October 14 go/no-go
GO only when:
- [ ] Production preflight is green.
- [ ] Payment processor is green.
- [ ] Every published product has at least one compliant ACTIVE batch or an intentional backorder rule.
- [ ] No unreviewed document applies to launch inventory.
- [ ] All launch product pages have final price/strength/images/content.
- [ ] Test order passes from checkout through lot assignment and fulfillment.
- [ ] Support/shipping processes are staffed.

If any critical item above is not checked, keep the affected product in DRAFT rather than bypassing the gate.

## 10. Data-integrity drills
- [ ] Customer return records quantity against the fulfilled assignment and places it in quarantine, not sellable inventory.
- [ ] Fulfilled-lot correction requires an audited reason and a same-product target lot with sufficient inventory.
- [ ] Corrected Shopify order metafield shows the replacement lot and excludes the superseded assignment.
- [ ] A corrected depleted source lot reopens in HOLD pending operator review.
