# Peptide Society — October 15 Go-Live Runbook

Target: October 15, 2026. The date does not override release gates.

## Technical gates

1. Production PostgreSQL provisioned and backups enabled.
2. Private S3-compatible document storage configured.
3. Production secrets stored only in the hosting platform secret manager.
4. `npm run prisma:migrate:deploy` succeeds.
5. `npm run check` succeeds.
6. `/api/readiness` returns HTTP 200.
7. `npm run smoke` passes against production.
8. Shopify webhooks registered for order create, cancellation, and fulfillment creation.
9. Test order proves exact PS lot is reserved and written back to Shopify.
10. Partial fulfillment test proves only shipped quantity becomes fulfilled.
11. Cancellation test proves unfulfilled reservations return to available inventory.
12. Hold test proves held lot cannot be selected for new orders.
13. Recall drill proves future fulfillment stops while prior order history remains traceable.
14. QR/lot verification resolves to the exact public batch record.
15. COA links expose only approved/public/current documents and never reveal bucket keys.

## Business/release gates

- Product identity/strength/SKU confirmed from supplier documentation.
- Supplier batch and manufacturer lot recorded.
- Required COA/testing documents received and reviewed.
- Product/batch status explicitly approved and Active before inventory is considered assignable.
- Legal/compliance review completed for each product being launched.
- Payment processor approval/acceptance confirmed for the actual business/product category.
- Shipping method/rates, returns/refunds policy, privacy/terms, customer support contact, and fulfillment SOP ready.
- Product pricing entered intentionally; no `$0.00` placeholders.
- Final storefront/mobile test completed.

## Launch-day sequence

1. Freeze non-critical code/theme changes.
2. Run database migration and quality gate.
3. Run production smoke test.
4. Confirm Shopify webhooks are delivering 2xx responses.
5. Create/verify the first real Active lots.
6. Scan physical QR samples and verify public records.
7. Place one controlled end-to-end order and verify lot assignment through fulfillment.
8. Only then change approved products from Draft to the intended storefront state.
9. Monitor webhook failures, inventory reservations, and verification traffic closely after launch.

## Immediate rollback triggers

- Webhook failure/retry storm.
- Lot assignment mismatch.
- Negative/incorrect available inventory.
- Wrong COA exposed for a lot.
- Public verification points to the wrong batch.
- Processor/shipping issue preventing clean checkout or fulfillment.

If triggered, stop new fulfillment, hold affected batches, and return impacted products to Draft/unavailable until reconciled.
