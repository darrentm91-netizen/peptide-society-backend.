const base = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

async function expect(path, acceptableStatuses, init) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.text();
  if (!acceptableStatuses.includes(response.status)) {
    throw new Error(`${path}: expected ${acceptableStatuses.join("/")}, got ${response.status}: ${body.slice(0, 300)}`);
  }
  console.log(`PASS ${path} -> ${response.status}`);
  return { response, body };
}

await expect("/api/health", [200]);
await expect("/api/readiness", [200]);
await expect("/api/verify/THIS-LOT-SHOULD-NOT-EXIST", [404]);
await expect("/api/webhooks/shopify/orders-create", [401], {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ admin_graphql_api_id: "gid://shopify/Order/1", line_items: [] }),
});
console.log("Smoke test complete.");
