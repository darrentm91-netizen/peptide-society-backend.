const required = [
  'DATABASE_URL',
  'PS_ADMIN_API_KEY',
  'SHOPIFY_SHOP',
  'SHOPIFY_ADMIN_ACCESS_TOKEN',
  'SHOPIFY_WEBHOOK_SECRET',
  'PUBLIC_VERIFY_BASE_URL',
  'APP_BASE_URL',
  'PUBLIC_STOREFRONT_ORIGINS',
  'DOCUMENT_STORAGE_MODE',
];

const problems = required.filter((key) => !process.env[key]);
const production = (process.env.NODE_ENV || 'development') === 'production';
const storageMode = (process.env.DOCUMENT_STORAGE_MODE || '').toLowerCase();

if (production && storageMode !== 's3') {
  problems.push('DOCUMENT_STORAGE_MODE must equal s3 in production');
}
if (storageMode === 's3') {
  for (const key of ['DOCUMENT_S3_BUCKET', 'DOCUMENT_S3_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) {
    if (!process.env[key]) problems.push(key);
  }
}

if (problems.length) {
  console.error('Environment check failed:');
  for (const item of [...new Set(problems)]) console.error(`- ${item}`);
  process.exit(1);
}
console.log('Environment check passed.');
