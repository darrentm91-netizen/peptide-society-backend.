# Peptide Society — October 15, 2026 Launch Critical Path

Target controlled launch: **October 15, 2026**.

## September 17–23 — Infrastructure & compliance blockers
- Connect production hosting.
- Provision PostgreSQL.
- Provision private S3-compatible document storage.
- Configure secrets and run `npm run preflight`.
- Register Shopify order/fulfillment/cancellation webhooks.
- Confirm payment processor will support the exact intended catalog before accepting orders.
- Establish legal/compliance disposition for every product; keep unresolved items Draft.

## September 24–30 — Real inventory & documentation
- Sync Shopify products into the batch database.
- Load actual suppliers and incoming shipments.
- Create one PS batch per real manufacturer lot.
- Upload manufacturer COAs and any independent testing.
- Review/approve documents.
- Generate QR records and print/validate labels against the correct lot.
- Activate only batches that pass release requirements.

## October 1–7 — End-to-end QA
- Place controlled test orders.
- Confirm automatic lot reservation and Shopify order metafield writes.
- Test partial fulfillment, full fulfillment, cancellation, refund/return handling, hold, and recall drill.
- Scan QR codes from physical labels and validate public records/COAs.
- Test desktop + mobile storefront and checkout.

## October 8–12 — Store operations
- Final shipping rates and packaging SOP.
- Final returns/refund policy, privacy, terms, contact/support process.
- Inventory reconciliation: physical count vs batch ledger vs Shopify.
- Processor test transaction and payout configuration.
- Customer support scripts for batch verification and documentation questions.

## October 13–14 — Go/no-go
Run:
1. `npm run preflight`
2. `/api/readiness`
3. protected `/api/admin/launch-status`
4. physical QR spot checks
5. final test order from storefront through fulfillment

Do not publish a product if its legal/compliance, processor, documentation, inventory, or fulfillment gate is unresolved.

## October 15 — Controlled launch
- Publish only cleared products.
- Start with verified inventory only.
- Monitor webhook failures, reservations, payment failures, and support requests closely.
- Do not bypass a failed launch gate to preserve the date.
