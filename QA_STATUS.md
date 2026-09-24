# V9 QA Status

## Passed in this build environment
- Protected admin-route static audit.
- Required environment-variable consistency audit.
- `.env.example` coverage audit.
- Prisma model → initial migration table coverage audit.
- New quarantine/correction counters present in both schema and migration.
- Shopify webhook registration GraphQL validated against the current Admin API schema.
- Webhook route mapping audit.
- Obvious credential/private-key pattern scan.
- QR → branded storefront verification bridge audit.
- Shopify Verify Batch theme writes were accepted on the unpublished Peptide Society Build theme.

## Not yet executable here
This environment could not reach/install the npm dependency graph in the available execution window. `npm install --package-lock-only` timed out, so the following are still **production deployment gates**:

- generate and retain `package-lock.json`
- `npm install` / clean dependency installation
- `npx prisma generate`
- `npx prisma validate`
- `npx prisma migrate deploy` against a disposable/production-like Postgres database
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run smoke` against the deployed HTTPS service

Docker/CI currently use `npm install --no-audit --no-fund` so a first deployment is not guaranteed to fail solely because the lockfile is absent. Once networked installation succeeds, generate and retain a lockfile and move Docker/CI back to `npm ci` for deterministic production builds.

## Release rule
Do not publish the theme or activate products based only on static audit success. Production preflight and the October 14 go/no-go checklist must pass.
