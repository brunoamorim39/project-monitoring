import { Context, Next } from 'hono';
import { getDb, getProjectByApiKey } from '../lib/db';
import type { Env } from '../types';

// API Key authentication for project submissions
export async function apiKeyAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const apiKey = c.req.header('X-API-Key');

  if (!apiKey) {
    return c.json({ success: false, error: 'Missing API key' }, 401);
  }

  const db = getDb(c.env.DB);
  const project = await getProjectByApiKey(db, apiKey);

  if (!project) {
    return c.json({ success: false, error: 'Invalid API key' }, 401);
  }

  // Store project in context for use in routes
  c.set('project', project);
  await next();
}

// Basic auth for admin dashboard
export async function basicAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const base64Credentials = authHeader.slice(6);
  const credentials = atob(base64Credentials);
  const [username, password] = credentials.split(':');

  const validUsername = c.env.ADMIN_USERNAME;
  const validPassword = c.env.ADMIN_PASSWORD;

  if (username !== validUsername || password !== validPassword) {
    return c.json({ success: false, error: 'Invalid credentials' }, 401);
  }

  await next();
}

// Optional basic auth (for endpoints that can be public or authenticated)
export async function optionalBasicAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (authHeader && authHeader.startsWith('Basic ')) {
    const base64Credentials = authHeader.slice(6);
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(':');

    const validUsername = c.env.ADMIN_USERNAME;
    const validPassword = c.env.ADMIN_PASSWORD;

    if (username === validUsername && password === validPassword) {
      c.set('isAuthenticated', true);
    }
  }

  await next();
}
