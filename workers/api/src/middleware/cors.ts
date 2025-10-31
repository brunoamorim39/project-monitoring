import { Context, Next } from 'hono';
import type { Env } from '../types';

export async function cors(c: Context<{ Bindings: Env }>, next: Next) {
  // Get project from context (set by apiKeyAuth middleware)
  const project = c.get('project');

  // Parse allowed origins from project settings
  let allowedOrigins: string[] = ['*'];
  if (project?.settings) {
    try {
      const settings = JSON.parse(project.settings);
      if (settings.allowedOrigins && Array.isArray(settings.allowedOrigins)) {
        allowedOrigins = settings.allowedOrigins;
      }
    } catch (e) {
      // Use default if parsing fails
    }
  }

  const origin = c.req.header('Origin') || '*';
  const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);

  if (isAllowed) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');
    c.header('Access-Control-Max-Age', '86400');
  }

  // Handle preflight
  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }

  await next();
}

// Simple CORS for admin endpoints (allow all for admin dashboard)
export async function simpleCors(c: Context, next: Next) {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }

  await next();
}
