# V7 Changes — Operations Control Center

## Added
- `/admin` internal operations UI with session-only admin API key entry.
- Launch go/no-go snapshot, blockers, product sync summary, batch release queue, document review, recent order-lot assignments.
- Batch actions from one screen: approve, activate, hold, release, recall.
- Document approval from the review queue.
- Protected admin APIs:
  - `GET /api/admin/documents`
  - `GET /api/admin/order-lots`
  - `GET /api/admin/products`

## Security notes
- The admin secret is never embedded into client source or environment-exposed variables.
- The operator enters the key after opening `/admin`; it is held only in browser `sessionStorage` and sent via Authorization header.
- Server-side `requireAdmin()` remains authoritative for every admin request.
- Recall requires an additional browser confirmation and every server action remains audit logged.

## Still required before production
- Put the admin application behind HTTPS and a private/admin-only hostname or access layer.
- Replace shared API-key authentication with SSO/session auth when a production identity provider is selected.
- Do not publish products until all launch gates are satisfied.
