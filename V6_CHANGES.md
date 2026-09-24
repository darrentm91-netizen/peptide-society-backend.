# V6 changes

- Added protected `GET /api/admin/launch-status` with technical, data, and external launch blockers.
- Added protected `GET /api/batches` with optional `status` and `productId` filters for operations visibility.
- Added `scripts/verify-env.mjs`.
- Added `npm run preflight` to combine environment validation, build quality gate, and smoke tests.
- Added date-based October 15 launch critical path.
- Kept external legal/compliance and processor approval as explicit launch blockers rather than pretending software can clear them.
- Documented the intentional public approved-document route exception so security audits do not misclassify it as an admin-auth gap.
