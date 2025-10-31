import { Hono } from 'hono';
import { apiKeyAuth, basicAuth } from './middleware/auth';
import { cors, simpleCors } from './middleware/cors';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { getDb, getDashboardStats } from './lib/db';

// Import routes
import feedback, { handleGetFeedback } from './routes/feedback';
import logs, { handleGetLogs } from './routes/logs';
import errors, { handleGetErrors } from './routes/errors';
import health, { handleGetHealthChecks } from './routes/health';
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
// Call handlers directly to bypass rate limiting middleware
admin.get('/feedback', handleGetFeedback);
admin.get('/logs', handleGetLogs);
admin.get('/errors', handleGetErrors);
admin.get('/health', handleGetHealthChecks);

// Mount projects route (admin only)
admin.route('/projects', projects);

// Mount stats endpoint
admin.get('/stats', async (c) => {
  try {
    const db = getDb(c.env.DB);
    const stats = await getDashboardStats(db);

    return c.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Get stats error:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error',
    }, 500);
  }
});

// ============================================
// Mount Routes
// ============================================

// Mount admin routes first (more specific path must come before general path)
app.route('/api/v1/admin', admin);
app.route('/api/v1', api);

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
