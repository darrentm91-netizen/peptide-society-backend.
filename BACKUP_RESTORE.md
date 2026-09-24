# Peptide Society — Backup & Restore Runbook

This system has two durable data planes and both must be recoverable together:

1. PostgreSQL — batch state, inventory ledger, lot assignments, audits, document metadata, webhook receipts.
2. Private object storage — COAs and analytical documents.

## Production policy
- Enable automated PostgreSQL backups / point-in-time recovery with the chosen host.
- Enable object-storage versioning where supported.
- Keep database backups and document storage private.
- Never place database dumps or COAs in the public Shopify theme, source repository, or public buckets.
- Record backup retention and restore ownership before launch.

## Database backup
Use the hosting provider's managed snapshot/PITR as the primary mechanism. A portable logical backup can also be made from an authorized workstation:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > peptide-society-$(date +%Y%m%d-%H%M%S).dump
```

Store the dump encrypted in a private backup location.

## Database restore drill
Restore into a **non-production** database first:

```bash
createdb peptide_society_restore_test
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" backup.dump
```

Then run:

```bash
DATABASE_URL="$RESTORE_DATABASE_URL" npx prisma migrate status
```

Validate at minimum:
- product count
- batch count and statuses
- inventory invariant audit
- document metadata count
- order-lot assignment count
- audit-event count
- webhook-event count

## Object-storage recovery
- Prefer provider versioning / lifecycle retention.
- Test retrieval of a representative manufacturer COA and independent test from the restored environment.
- Database `storageKey` values must still resolve to the correct private objects.
- Do not regenerate or silently replace historical documents if an original version can be restored.

## Recovery order after incident
1. Freeze fulfillment / keep affected Shopify products DRAFT or unavailable if integrity is uncertain.
2. Restore database to a verified point.
3. Restore/verify object storage versions.
4. Run migrations if required by the deployed app version.
5. Run inventory invariant audit.
6. Verify one Active, one Depleted/Hold, and one Recalled public lot record.
7. Replay only webhooks known to be missing; do not blindly replay all events because reservations are stateful.
8. Run a test order through reservation and fulfillment before reopening sales.

## Restore evidence
For every restore drill record:
- date/time
- operator
- backup timestamp/version
- database row counts
- inventory audit result
- sample document checks
- time to restore
- issues/remediation

Run at least one successful restore drill before October 15 launch.
