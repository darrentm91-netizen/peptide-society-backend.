# V8 changes — storefront verification bridge

- Added allow-listed CORS for the public batch verification API.
- Added OPTIONS/preflight handling for storefront JavaScript.
- Production environment now requires `PUBLIC_STOREFRONT_ORIGINS`.
- Verification responses include short public cache headers while recall/status changes remain quickly refreshable.
- Prepared the Shopify Verify Batch theme section to accept a public API base URL after deployment; no secrets are stored in Shopify theme code.
- Public document links remain relative to the backend and are resolved by the storefront against the configured public API base URL.
