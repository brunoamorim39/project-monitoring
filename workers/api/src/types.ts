import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  RATE_LIMIT_KV: KVNamespace;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  ENVIRONMENT: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  apiKey: string;
  createdAt: number;
  settings?: string;
  lastHealthCheck?: number;
}
