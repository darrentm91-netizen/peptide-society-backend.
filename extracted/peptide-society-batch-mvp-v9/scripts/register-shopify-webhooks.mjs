const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

const shop = required('SHOPIFY_SHOP').replace(/^https?:\/\//, '').replace(/\/$/, '');
const token = required('SHOPIFY_ADMIN_ACCESS_TOKEN');
const baseUrl = required('APP_BASE_URL').replace(/\/$/, '');
const version = process.env.SHOPIFY_API_VERSION || '2026-07';
const endpoint = `https://${shop}/admin/api/${version}/graphql.json`;

const wanted = [
  ['ORDERS_CREATE', `${baseUrl}/api/webhooks/shopify/orders-create`],
  ['ORDERS_CANCELLED', `${baseUrl}/api/webhooks/shopify/orders-cancelled`],
  ['FULFILLMENTS_CREATE', `${baseUrl}/api/webhooks/shopify/fulfillments-create`],
];

async function graphql(query, variables = {}) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Shopify HTTP ${response.status}: ${JSON.stringify(body)}`);
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  return body.data;
}

const LIST = `#graphql
query ExistingPeptideSocietyWebhooks($topics: [WebhookSubscriptionTopic!]) {
  webhookSubscriptions(first: 100, topics: $topics) {
    nodes { id topic uri format }
    pageInfo { hasNextPage endCursor }
  }
}`;

const CREATE = `#graphql
mutation CreatePeptideSocietyWebhook($topic: WebhookSubscriptionTopic!, $subscription: WebhookSubscriptionInput!) {
  webhookSubscriptionCreate(topic: $topic, webhookSubscription: $subscription) {
    webhookSubscription { id topic uri format }
    userErrors { field message }
  }
}`;

const topics = wanted.map(([topic]) => topic);
const existing = (await graphql(LIST, { topics })).webhookSubscriptions;
if (existing.pageInfo.hasNextPage) {
  throw new Error('More than 100 matching webhook subscriptions exist; inspect manually before registering more.');
}

let created = 0;
let skipped = 0;
for (const [topic, uri] of wanted) {
  const exact = existing.nodes.find((node) => node.topic === topic && node.uri === uri && node.format === 'JSON');
  if (exact) {
    console.log(`SKIP ${topic}: ${uri} (${exact.id})`);
    skipped += 1;
    continue;
  }

  const sameTopicElsewhere = existing.nodes.filter((node) => node.topic === topic && node.uri !== uri);
  if (sameTopicElsewhere.length) {
    console.warn(`WARN ${topic}: existing subscription(s) point elsewhere:`);
    for (const node of sameTopicElsewhere) console.warn(`  - ${node.uri} (${node.id})`);
    console.warn('  Creating the requested deployment URL as an additional subscription; remove stale subscriptions deliberately after cutover.');
  }

  const data = await graphql(CREATE, {
    topic,
    subscription: { uri, format: 'JSON' },
  });
  const result = data.webhookSubscriptionCreate;
  if (result.userErrors?.length) throw new Error(`${topic}: ${result.userErrors.map((e) => e.message).join('; ')}`);
  console.log(`CREATE ${topic}: ${result.webhookSubscription.uri} (${result.webhookSubscription.id})`);
  created += 1;
}

console.log(`Webhook registration complete. created=${created} skipped=${skipped}`);
