import { defineConfig } from 'drizzle-kit';

// Remote-only Drizzle configuration using D1 HTTP driver
if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_DATABASE_ID || !process.env.CLOUDFLARE_API_TOKEN) {
  // eslint-disable-next-line no-console
  console.warn('[drizzle] Missing Cloudflare credentials. Ensure .dev.vars has CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_API_TOKEN.');
}

const config = {
  dialect: 'sqlite' as const,
  driver: 'd1-http' as const,
  schema: './workers/api/src/lib/schema.ts',
  out: './workers/api/drizzle',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    token: process.env.CLOUDFLARE_API_TOKEN!,
  },
};

export default defineConfig({
  ...config,
  // Include all tables
  tablesFilter: ['*'],
  // Strict mode for better type safety
  strict: true,
  verbose: true
});
