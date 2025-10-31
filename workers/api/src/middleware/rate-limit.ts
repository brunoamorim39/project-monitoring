import { Context, Next } from 'hono';
import type { Env } from '../types';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  feedback: { maxRequests: 100, windowMs: 60 * 60 * 1000 }, // 100 per hour
  logs: { maxRequests: 1000, windowMs: 60 * 60 * 1000 }, // 1000 per hour
  errors: { maxRequests: 500, windowMs: 60 * 60 * 1000 }, // 500 per hour
  health: { maxRequests: 200, windowMs: 60 * 60 * 1000 }, // 200 per hour
};

export function rateLimitMiddleware(type: keyof typeof RATE_LIMITS) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const project = c.get('project');
    if (!project) {
      return c.json({ success: false, error: 'Project not found' }, 400);
    }

    const config = RATE_LIMITS[type];
    const key = `ratelimit:${project.id}:${type}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // Try to use KV for persistent rate limiting
      const kv = c.env.RATE_LIMIT_KV;

      // Get current count from KV
      const data = await kv.get(key, 'json') as { count: number; resetAt: number } | null;

      if (data) {
        // Check if window has expired
        if (now >= data.resetAt) {
          // Reset the counter
          await kv.put(key, JSON.stringify({ count: 1, resetAt: now + config.windowMs }), {
            expirationTtl: Math.ceil(config.windowMs / 1000),
          });
        } else if (data.count >= config.maxRequests) {
          // Rate limit exceeded
          const resetIn = Math.ceil((data.resetAt - now) / 1000);
          return c.json(
            { success: false, error: `Rate limit exceeded. Try again in ${resetIn} seconds.` },
            429
          );
        } else {
          // Increment counter
          await kv.put(key, JSON.stringify({ count: data.count + 1, resetAt: data.resetAt }), {
            expirationTtl: Math.ceil((data.resetAt - now) / 1000),
          });
        }
      } else {
        // First request in this window
        await kv.put(key, JSON.stringify({ count: 1, resetAt: now + config.windowMs }), {
          expirationTtl: Math.ceil(config.windowMs / 1000),
        });
      }
    } catch (error) {
      // If KV fails, log but don't block the request
      console.error('Rate limit KV error:', error);
    }

    await next();
  };
}
