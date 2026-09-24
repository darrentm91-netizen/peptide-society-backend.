# V9 — production data integrity pass

- Fixed S3 environment-name mismatch. Runtime, `.env.example`, readiness, and `verify:env` now agree on `DOCUMENT_S3_*` plus standard AWS credentials.
- S3 readiness now checks bucket, region, access key, and secret key.
- Added first real Prisma/PostgreSQL migration so `prisma migrate deploy` can create a production database reproducibly.
- Added customer-return quarantine tracking. Returns never flow automatically back into sellable inventory.
- Added audited fulfilled-lot correction. A correction moves the fulfillment accounting to the documented actual lot, marks the prior assignment CORRECTED, writes two audit events, and updates the Shopify order metafield.
- If correcting a lot reopens a previously DEPLETED source batch, that batch reopens into HOLD rather than silently becoming sellable.
- Added `quantityQuarantined` to batches and `quantityReturned` to order-lot assignments.
- Shopify order lot JSON now includes `quantity_returned`.
- QR links now open the branded Shopify Verify Batch page using `?lot=...&t=...`; they no longer send customers to raw backend JSON.

## Inventory integrity gate
- Added protected `GET /api/admin/inventory-audit`.
- Launch status now treats inventory invariant drift as a technical blocker.
- Audit reconciles batch reserved/fulfilled/quarantined counters to order-lot assignments and checks the batch ledger balance.
- Fulfilled lot corrections now require the destination lot to still be `ACTIVE` and use an atomic availability/status guard.
- CI configuration now includes storefront origin and customer-facing Verify Batch URL placeholders.

## Deployment automation
- Added `APP_BASE_URL` as a required deployment setting.
- Added duplicate-aware `npm run shopify:webhooks:register` script for orders/create, orders/cancelled, and fulfillments/create.
- Added `BACKUP_RESTORE.md` with PostgreSQL + private object-storage recovery procedures and restore-drill requirements.
- Readiness and launch-status now require `APP_BASE_URL`, preventing webhook setup from being forgotten.
- Admin dashboard now surfaces inventory invariant violations as a first-class launch metric.
- Docker/CI use `npm install` temporarily because a lockfile cannot be generated in this restricted runtime; `QA_STATUS.md` makes restoring deterministic `npm ci` a deployment gate.
- Added `LAUNCH_INPUTS_REQUIRED.md` so remaining owner/account/supplier inputs are explicit rather than hidden inside technical notes.
