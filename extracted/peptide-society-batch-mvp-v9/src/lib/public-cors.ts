const normalizeOrigin = (value: string) => value.trim().replace(/\/$/, "");

export function configuredStorefrontOrigins() {
  const raw = process.env.PUBLIC_STOREFRONT_ORIGINS || process.env.PUBLIC_STOREFRONT_ORIGIN || "";
  return raw.split(",").map(normalizeOrigin).filter(Boolean);
}

export function publicCorsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = configuredStorefrontOrigins();
  const headers: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };

  if (origin && allowed.includes(normalizeOrigin(origin))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function isAllowedStorefrontOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // direct browser navigation / server-to-server reads
  return configuredStorefrontOrigins().includes(normalizeOrigin(origin));
}
