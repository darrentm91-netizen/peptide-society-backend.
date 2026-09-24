# Peptide Society — October 15, 2026 Launch Gate

Target: begin selling only after every **Launch Blocker** below is cleared.

## Launch Blockers

- [ ] Legal/compliance review completed for each product actually offered.
- [ ] Final supplier catalog confirmed; remove/archive products not being sold.
- [ ] Payment processor explicitly approved for the actual product catalog/business model.
- [ ] Shopify trial upgraded to a selling-capable plan.
- [ ] Shipping method, package weights, rates, fulfillment address, and return workflow configured.
- [ ] Production PostgreSQL database deployed with backups.
- [ ] Private durable COA/document storage deployed; no local filesystem in production.
- [~] Admin API-key authentication implemented; route-by-route enforcement audit still required before deployment.
- [ ] Shopify app credentials and webhook secret stored in production secrets manager.
- [ ] Shopify product sync tested against production database.
- [ ] At least one real incoming shipment entered through Supplier → Shipment → Manufacturer Batch → PS Batch.
- [ ] Manufacturer COA uploaded, reviewed, versioned, and approved for every Active batch.
- [ ] Any required independent testing completed/reviewed before the batch is activated.
- [ ] QR generated from the real PS lot and verified against the public batch endpoint.
- [ ] Public verification page displays only approved/current/customer-facing records.
- [ ] Shopify order-create webhook reserves exact lot inventory idempotently.
- [ ] Order cancellation releases reservations.
- [ ] Full and partial fulfillment correctly lock fulfilled lot quantities.
- [ ] Shopify order metafield `peptide_society.lot_assignments` matches database assignments.
- [ ] One end-to-end test order completed from checkout → lot reservation → fulfillment → customer verification.
- [ ] Recall/Hold drill completed on a deployed test batch (recall + impacted-order endpoints now implemented).
- [ ] Product prices, strengths, SKUs, weights, images, descriptions, and policies finalized.
- [ ] Mobile checkout/product/verification QA completed.
- [ ] Terms, privacy, shipping, refund/return, contact/support, and research-use language reviewed.
- [ ] Products remain Draft until all applicable blockers above are cleared.

## September 17–25 — Backend + Infrastructure

1. Deploy the batch app and PostgreSQL to a production-like environment.
2. Configure secrets and durable document storage.
3. Add admin authentication/authorization.
4. Register Shopify webhooks against the deployed HTTPS URL.
5. Run Prisma migration, automated tests, production build, and webhook integration tests.
6. Finish recall workflow and customer-impact query.

## September 26–October 3 — Real Product + Batch Data

1. Confirm supplier catalog and exact compounds/strengths.
2. Archive/remove placeholder products that will not launch.
3. Enter real suppliers, shipments, manufacturer lots, quantities, and dates.
4. Upload manufacturer COAs and independent testing where applicable.
5. Create/approve/activate launch batches and generate QR codes.
6. Finalize product photos, prices, SKUs, weights, descriptions, and research content.

## October 4–9 — Commerce Setup

1. Confirm processor approval before enabling payment acceptance.
2. Upgrade Shopify plan.
3. Configure shipping rates/packages and return process.
4. Finish policies and support/contact workflow.
5. Wire customer-account batch/COA view.
6. Run checkout, taxes, email notifications, mobile, and browser QA.

## October 10–14 — Launch Rehearsal

1. Run at least two controlled end-to-end test orders.
2. Test split-lot order and partial fulfillment.
3. Test cancellation and reservation release.
4. Test Batch Hold and public verification persistence.
5. Test wrong-lot correction/audit flow.
6. Verify every launch QR from a phone.
7. Final inventory reconciliation: Shopify sellable quantity vs PS Active-lot availability.
8. Final go/no-go review against this checklist.

## October 15 — Controlled Launch

- Activate only products with cleared legal/payment/testing/documentation gates.
- Start with conservative inventory levels.
- Monitor webhook failures, reservation mismatches, payment failures, and support messages throughout launch day.
- Do not activate unresolved products merely to meet the date.
