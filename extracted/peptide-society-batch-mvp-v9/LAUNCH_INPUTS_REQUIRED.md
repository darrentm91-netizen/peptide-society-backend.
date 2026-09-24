# Inputs / connections still required from the owner

Everything below depends on real accounts, supplier evidence, or business decisions that cannot be invented by the build.

## Infrastructure connection
- Connect a production host (Railway is a practical fit for this stack; Vercel + external Postgres also works).
- Provision production PostgreSQL with backups/PITR.
- Provision private S3-compatible object storage and provide credentials through the host secret manager.
- Decide the final backend hostname, e.g. `batch.peptidesociety.com`.
- Decide/finalize the customer-facing storefront domain.

## Shopify / commerce
- Upgrade the Shopify trial to a selling-capable plan before launch if still on trial.
- Obtain/confirm the Shopify Admin API credentials/scopes used by the production backend.
- Payment processor approval for the exact intended product catalog/business model.
- Final shipping rates/zones/carriers.
- Final return/refund policy, privacy/terms, support email, business contact details.

## Catalog
For each product actually launching:
- exact manufacturer product identity
- exact strength/size
- final SKU
- final retail price
- actual vial/container reference or product imagery
- supplier/manufacturer identity
- manufacturer lot number
- quantity received
- manufacture/retest/expiration dates if supplied
- manufacturer COA
- independent test results where required

Do not infer a scientific identity from a broad supplier label such as “GLP-1.” Use the supplier label/COA/catalog identity exactly and review it before creating a sellable listing.

## Compliance
- Product-by-product legal/compliance review for identity, labeling, claims, permitted sale, and research-use positioning.
- Retatrutide remains unpublished unless specifically cleared.

## Launch-day owner decisions
- Which specific products are in the initial October 15 release.
- Whether inventory opens all at once or via a controlled soft launch.
- Final support/fulfillment staffing and cutoff times.
