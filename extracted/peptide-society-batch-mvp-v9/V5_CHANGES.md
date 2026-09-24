# Peptide Society Batch MVP V5

## Production-readiness additions

- Added a storage abstraction for private batch documents.
- Added S3/S3-compatible durable object storage support.
- Public verification never exposes the private object-storage key; documents are streamed only after DB approval/public visibility checks.
- Added `X-Content-Type-Options: nosniff` on document responses.
- Added Docker production build and local PostgreSQL compose file.
- Added CI quality gate: Prisma generate + migrations + typecheck + tests + Next build.
- Added launch smoke-test command covering health, readiness, missing-lot verification, and unsigned-webhook rejection.
- Added production migration script.

## Still required before launch

- Run `npm ci` and the full quality gate in a network-enabled deployment environment.
- Configure real PostgreSQL.
- Configure private S3-compatible storage and credentials.
- Register live Shopify webhook subscriptions against the deployed URL.
- Complete real order/partial fulfillment/cancellation/recall test cases.
- Load actual supplier batches and supporting COA/testing documents.
- Keep all sellable products Draft until legal/compliance, processor, shipping, and release gates are satisfied.
