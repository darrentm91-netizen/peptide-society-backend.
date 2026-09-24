# Security Notes — V4

## Implemented

- Admin API-key authentication on batch creation, document administration, lifecycle actions, recall, manual order-lot actions, and Shopify product sync.
- Actor identity is derived only after authentication. Client-supplied `userId` values are no longer trusted by administrative routes.
- Shopify webhook HMAC verification remains separate from admin authentication.
- Webhook event IDs are persisted to prevent duplicate reservation/fulfillment processing.
- Public verification exposes only approved, public, non-superseded documents.
- Recall leaves verification history intact and exposes a recall notice.
- Production readiness fails when local document storage is used without an explicit unsafe override.

## Must be completed before launch

- Replace the single admin API key with role-based staff authentication before giving access to multiple people.
- Put all secrets in the deployment provider's secret manager; never commit `.env`.
- Add rate limiting/WAF protection to public verification and admin APIs.
- Add durable private object storage for COAs with signed or application-proxied access.
- Enable database backups and test restoration.
- Centralize logs/alerts for failed Shopify webhooks and readiness failures.

## Public document route exception
`GET /api/batches/:id/documents/:filename` is intentionally not protected by the admin API key. It is the public document-delivery path used after the service verifies that the requested batch document is approved, public-visible, current (not superseded), and associated with the requested batch. Storage credentials and private object keys are never returned to the caller.
