type ShopifyGraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type ShopifyTokenResponse = {
  access_token: string;
  scope?: string;
  expires_in: number;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

export function shopifyShop(): string {
  return required("SHOPIFY_SHOP").replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export async function shopifyAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) return cachedToken.value;

  const response = await fetch(`https://${shopifyShop()}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: required("SHOPIFY_CLIENT_ID"),
      client_secret: required("SHOPIFY_CLIENT_SECRET"),
    }),
    cache: "no-store",
  });

  const body = (await response.json()) as ShopifyTokenResponse & { error?: string; error_description?: string };
  if (!response.ok || !body.access_token) {
    throw new Error(`Shopify token request failed with ${response.status}: ${body.error_description || body.error || "unknown error"}`);
  }

  const ttlSeconds = Number(body.expires_in) || 3600;
  cachedToken = { value: body.access_token, expiresAt: now + ttlSeconds * 1000 };
  return cachedToken.value;
}

export async function shopifyGraphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = await shopifyAccessToken();
  const version = process.env.SHOPIFY_API_VERSION || "2026-07";

  const response = await fetch(`https://${shopifyShop()}/admin/api/${version}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Shopify request failed with ${response.status}`);
  const body = (await response.json()) as ShopifyGraphqlResponse<T>;
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
  if (!body.data) throw new Error("Shopify returned no data");
  return body.data;
}
