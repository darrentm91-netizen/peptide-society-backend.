# Peptide Society — Batch & Verification MVP v3

This project is the first working backend slice for Peptide Society's research-material batch traceability system.

## Architecture

- **Shopify:** commerce/product source of truth.
- **PostgreSQL + Prisma:** batch, document, QR, inventory-ledger, lot-assignment, and audit source of truth.
- **Next.js route handlers:** admin/API surface.
- **Research-use workflow:** product-level research content stays in Shopify; lot-specific COAs/testing stay in the batch database.

## Implemented workflows

### Shopify product sync
`POST /api/products/sync`

Syncs Shopify products with product type `Research Compound`. Each product must have:
- `peptide_society.lot_code`
- `peptide_society.vial_template`
- `peptide_society.batch_tracking_enabled`

The current MVP intentionally requires **one Shopify variant per research product**. If a product gains multiple strength variants, add variant-level lot codes before enabling that product in this backend. The sync fails closed rather than guessing a lot code.

Current Shopify lot codes:
- BPC-157 → `BPC`
- Retatrutide → `RETA`
- NAD+ → `NAD`
- Glutathione → `GSH`

### Create Batch
`POST /api/batches`

Creates:
- manufacturer batch
- Peptide Society batch
- collision-safe PS lot number (`PS-{LOT_CODE}-{YYMMDD}-{NN}`)
- initial `RECEIVED` inventory ledger event
- immutable audit event

New batches do **not** become Active automatically.

### Document/version workflow
- `GET /api/batches/:id/documents`
- `POST /api/batches/:id/documents` (multipart)
- `POST /api/documents/:id/approve`
- `GET /api/batches/:id/documents/:filename` for approved/public/current files

Supported MVP uploads: PDF, PNG, JPEG, max 15 MB.

Every replacement creates a new version. Older files are marked superseded rather than overwritten. Public serving is restricted to approved, public-visible, non-superseded documents.

Independent testing becomes `INDEPENDENT_VERIFIED` only when an approved independent COA exists, or when both approved identity and purity tests exist.

### Batch lifecycle
- `POST /api/batches/:id/approve`
- `POST /api/batches/:id/activate`
- `POST /api/batches/:id/hold`
- `POST /api/batches/:id/release`

Rules include:
- approved manufacturer COA required before batch approval
- only Approved batches can become Active
- Hold blocks future lot assignment without deleting history
- releasing Hold restores Approved or Active based on prior activation state
- recalled/depleted/archived batches cannot be casually reactivated

### QR + public verification
- `POST /api/batches/:id/qr`
- `GET /api/verify/:lotNumber`

QR generation uses a cryptographically random verification token and returns an SVG. Public verification exposes only batch/customer-facing fields and approved public documents. Manual lot-number lookup remains possible without the QR token; a supplied invalid token is rejected.

### Order lot reservation / fulfillment
- `POST /api/orders/:orderId/reserve-lot`
- `POST /api/orders/:orderId/release-reservation`
- `POST /api/orders/:orderId/confirm-fulfillment`

Inventory accounting:
- reserve: available decreases, reserved increases
- cancellation/release: reserved decreases, available increases
- fulfillment: reserved decreases, fulfilled increases; available is **not** decremented twice
- when available and reserved both reach zero after fulfillment, the batch becomes Depleted

Only Active lots can be reserved. Reservations use a conditional database update to reduce overselling races.


### Shopify order automation (v3)
- `POST /api/webhooks/shopify/orders-create`
- `POST /api/webhooks/shopify/orders-cancelled`
- `POST /api/webhooks/shopify/fulfillments-create`

Behavior:
- verifies Shopify HMAC before parsing
- deduplicates deliveries using `X-Shopify-Event-Id`
- reserves oldest eligible Active lots first
- can split a single order line across multiple lots when needed
- fails closed if approved Active lot inventory is insufficient
- writes exact lot assignments back to the Shopify order metafield `peptide_society.lot_assignments`
- cancelled orders release open reservations
- fulfillment moves reserved quantity to fulfilled and updates the Shopify order lot record

Partial Shopify fulfillments are supported: a reservation row is split so fulfilled quantity is locked while the unfulfilled remainder stays reserved.

## Environment

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/peptide_society"
PUBLIC_VERIFY_BASE_URL="https://peptidesociety.com/verify"
DOCUMENT_STORAGE_DIR="./storage/batch-documents"
SHOPIFY_SHOP="your-store.myshopify.com"
SHOPIFY_ADMIN_ACCESS_TOKEN="shpat_replace_me"
SHOPIFY_API_VERSION="2026-07"
SHOPIFY_WEBHOOK_SECRET="replace_me"
```

Do not commit real access tokens.

## Local setup

```bash
npm install
npx prisma generate
npx prisma migrate dev --name batch_v3
npm test
npm run build
npm run dev
```

## Production hardening still required

1. Replace local document filesystem storage with durable private S3-compatible object storage and signed/public delivery rules.
2. Add authentication/authorization for every admin route; `userId` must come from authenticated session context rather than trusting request JSON.
3. Register Shopify webhook subscriptions after a public HTTPS deployment URL exists; add product-update webhook sync.
4. Add database-backed integration tests for webhook idempotency, lifecycle, partial fulfillment, and concurrency paths.
5. Add recall workflow and customer-impact reporting before launch.
6. Add production observability, backups, file malware scanning, retention rules, and secrets management.
7. Add customer-account lot/COA presentation after the order metafield is written.
8. Keep products in Draft until legal/compliance, testing, payment, shipping, and launch-readiness checks are complete.

## Validation status in this artifact

The Shopify metafield operations used during this build were schema-validated through Shopify before execution, and the `lot_code` values were successfully stored on the four draft products.

This runtime repeatedly timed out while fetching npm dependencies, so **Prisma generation, automated tests, and the Next.js production build have not been executed for v3 here**. Run the Local setup commands above in a normal networked development environment before deployment.

## V4 launch-hardening additions

See `V4_CHANGES.md`, `DEPLOYMENT.md`, and `SECURITY.md`. Administrative actions now require server-side authentication, recall/customer-impact workflow is implemented, and production readiness intentionally fails if the deployment is missing secrets/database access or is still relying on local document storage.

## V7 operations UI
After deployment, open `/admin` for the internal Peptide Society Operations Control Center. See `ADMIN_OPERATIONS.md` and `PRE_LAUNCH_CHECKLIST.md`.
