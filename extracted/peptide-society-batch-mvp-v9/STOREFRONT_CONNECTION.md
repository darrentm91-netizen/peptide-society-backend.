# Shopify storefront → batch backend connection

After production deployment:

1. Set `PUBLIC_STOREFRONT_ORIGINS` on the backend to the allowed storefront origin(s), for example `https://kkwzpp-e1.myshopify.com` and the final custom domain when available.
2. Set `PUBLIC_VERIFY_BASE_URL` to the **customer-facing Shopify Verify Batch page**, for example `https://peptidesociety.com/pages/verify-batch`. Generated QR codes will use `?lot=<PSLOT>&t=<token>` on that page.
3. In the unpublished **Peptide Society Build** theme, open the **PS Verify Batch** section and set **Verification API base URL** to the backend origin, for example `https://batch.peptidesociety.com`. This is public API routing only; no secret is stored in the theme.
4. QR scans land on the branded Shopify page. The QR bridge prefills the lot, forwards the verification token only to the backend verification request, and auto-loads the current public record.
5. Verify a known Active lot, a Held lot, a Depleted lot, and a Recalled lot from the storefront.
6. Confirm approved document links open through the backend document endpoint and never reveal S3 credentials/object keys.
7. Do not publish the theme or activate sellable products until the full launch gate passes.
