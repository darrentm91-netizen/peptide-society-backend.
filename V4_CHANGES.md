# V4 — Launch Hardening

- Added server-side admin authentication helper using a constant-time API-key comparison.
- Removed trust in request-body user IDs for administrative actions.
- Protected Create Batch, Approve, Activate, Hold, Release, QR creation, document list/upload/approval, manual order-lot actions, impacted-order lookup, recall, and product sync.
- Added batch recall workflow with automatic release of unfulfilled reservations.
- Added fulfilled-order impact query for recalled batches.
- Added `recalledAt` and persistent public recall notice.
- Added liveness and readiness endpoints.
- Added production guard against accidental local COA storage.
- Added production deployment and security runbooks.
