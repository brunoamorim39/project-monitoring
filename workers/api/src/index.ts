import { Hono } from 'hono';
import { apiKeyAuth, basicAuth } from './middleware/auth';
import { cors, simpleCors } from './middleware/cors';
import { rateLimitMiddleware } from './middleware/rate-limit';

// Import routes
import feedback from './routes/feedback';
import logs from './routes/logs';
import errors from './routes/errors';
import health from './routes/health';
import projects from './routes/projects';

import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// ============================================
// Health Check Endpoint
// ============================================

app.get('/', (c) => {
  return c.json({
    service: 'project-monitoring-api',
    status: 'healthy',
    version: '1.0.0',
  });
});

// ============================================
// Public Submission Endpoints (Require API Key)
// ============================================

const api = new Hono<{ Bindings: Env }>();

// Apply API key auth and CORS to all submission routes
api.use('*', apiKeyAuth);
api.use('*', cors);

// Mount submission routes with rate limiting
api.route('/feedback', feedback.use('*', rateLimitMiddleware('feedback')));
api.route('/logs', logs.use('*', rateLimitMiddleware('logs')));
api.route('/errors', errors.use('*', rateLimitMiddleware('errors')));
api.route('/health', health.use('*', rateLimitMiddleware('health')));

// ============================================
// Admin Query Endpoints (Require Basic Auth)
// ============================================

const admin = new Hono<{ Bindings: Env }>();

// Apply basic auth and simple CORS to all admin routes
admin.use('*', simpleCors);
admin.use('*', basicAuth);

// Mount query routes (GET requests for dashboard)
admin.get('/feedback', async (c) => {
  // Forward to feedback route GET handler
  const feedbackRoute = feedback;
  return feedbackRoute.request(c.req.raw, c.env);
});

admin.get('/logs', async (c) => {
  const logsRoute = logs;
  return logsRoute.request(c.req.raw, c.env);
});

admin.get('/errors', async (c) => {
  const errorsRoute = errors;
  return errorsRoute.request(c.req.raw, c.env);
});

admin.get('/health', async (c) => {
  const healthRoute = health;
  return healthRoute.request(c.req.raw, c.env);
});

// Mount projects route (admin only)
admin.route('/projects', projects);

// Mount stats endpoint
admin.get('/stats', async (c) => {
  const projectsRoute = projects;
  // Create a modified request to hit the stats endpoint
  const url = new URL(c.req.url);
  url.pathname = '/api/v1/projects/dashboard/stats';
  const modifiedReq = new Request(url, c.req.raw);
  return projectsRoute.request(modifiedReq, c.env);
});

// ============================================
// Mount Routes
// ============================================

app.route('/api/v1', api);
app.route('/api/v1/admin', admin);

// ============================================
// Error Handling
// ============================================

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    success: false,
    error: 'Internal server error',
  }, 500);
});

// 404 Handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not found',
  }, 404);
});

export default app;
