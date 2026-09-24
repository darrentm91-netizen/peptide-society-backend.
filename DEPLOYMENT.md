# Peptide Society Batch MVP — Production Deployment Gate

## Required before launch

1. Deploy PostgreSQL with automated backups and point-in-time recovery if available.
2. Generate a long random `PS_ADMIN_API_KEY` and store it only in server-side secrets.
3. Store Shopify Admin token and webhook secret in the deployment secret manager.
4. Set `PUBLIC_VERIFY_BASE_URL` to the real HTTPS verification URL.
5. Replace local document storage with durable private object storage before production. The readiness endpoint intentionally fails in production when `DOCUMENT_STORAGE_MODE=local` unless explicitly overridden.
6. Run `prisma generate`, apply the production migration, run tests, then run `next build`.
7. Register Shopify webhooks only after the deployed HTTPS endpoints are reachable.
8. Use `/api/health` for liveness and `/api/readiness` for deployment readiness.

## Admin API authentication

All administrative read/write routes should require one of:

- `Authorization: Bearer <PS_ADMIN_API_KEY>`
- `x-ps-admin-key: <PS_ADMIN_API_KEY>`

Trusted internal clients may additionally send `x-ps-admin-user` to identify the actor in the audit log. This header is only trusted after the API key has been verified.

This is an MVP server-to-server protection layer. Before adding multiple staff accounts, replace it with role-based authentication/session management.

## Recall drill

1. Create a test batch and activate it.
2. Reserve and fulfill at least one test order.
3. Reserve another unfulfilled test order.
4. POST `/api/batches/:id/recall` with a meaningful reason.
5. Confirm the open reservation is released and cannot be re-assigned from the recalled lot.
6. GET `/api/batches/:id/impacted-orders` and verify fulfilled orders are listed.
7. Verify `/api/verify/:lot` still resolves the lot but shows `batchStatus=RECALLED`, `recalledAt`, and `recallNotice`.
8. Confirm the lot remains inaccessible to new automatic reservations.

## Go-live rule

Do not publish a product simply because the application is deployed. Product-level legal/compliance review, supplier documentation, payment processor approval, shipping configuration, and batch release criteria remain separate launch gates.

## V5 private object storage

For production set `DOCUMENT_STORAGE_MODE=s3` and configure `DOCUMENT_S3_BUCKET`, region, and credentials. `DOCUMENT_S3_ENDPOINT` and `DOCUMENT_S3_FORCE_PATH_STYLE=true` allow S3-compatible providers such as private R2-style endpoints. The bucket should be private; customers receive documents through the application only after batch-document approval/public-visibility checks.

## V5 quality gate

Run before every production release:

```bash
npm ci
npm run prisma:migrate:deploy
npm run check
```

After deployment:

```bash
SMOKE_BASE_URL=https://your-backend.example npm run smoke
```

Do not publish products if readiness is non-200 or the smoke test fails.

## Register Shopify webhooks after deployment
Set `APP_BASE_URL` to the backend HTTPS origin, then run:

```bash
npm run shopify:webhooks:register
```

The script is duplicate-aware for the exact topic + URL and registers:
- `ORDERS_CREATE` → `/api/webhooks/shopify/orders-create`
- `ORDERS_CANCELLED` → `/api/webhooks/shopify/orders-cancelled`
- `FULFILLMENTS_CREATE` → `/api/webhooks/shopify/fulfillments-create`

If an old deployment URL remains subscribed, the script warns rather than deleting it automatically. Remove stale subscriptions deliberately only after cutover is verified.
