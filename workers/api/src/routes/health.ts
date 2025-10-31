import { Hono } from 'hono';
import { getDb, createHealthCheck, getHealthChecks } from '../lib/db';
import { submitHealthCheckSchema, healthQuerySchema } from '@project-monitoring/shared';
import type { Env } from '../types';

const health = new Hono<{ Bindings: Env }>();

// POST /api/v1/health - Submit health check
health.post('/', async (c) => {
  try {
    const project = c.get('project');
    const body = await c.req.json();

    // Validate input
    const validation = submitHealthCheckSchema.safeParse(body);
    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      }, 400);
    }

    const data = validation.data;
    const db = getDb(c.env.DB);

    // Create health check entry
    await createHealthCheck(db, project.id, {
      status: data.status,
      responseTime: data.responseTime,
      metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
    });

    return c.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Health check submission error:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error',
    }, 500);
  }
});

// GET /api/v1/health - Query health checks (admin only)
health.get('/', async (c) => {
  try {
    const query = c.req.query();
    const validation = healthQuerySchema.safeParse(query);

    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Invalid query parameters',
        details: validation.error.errors,
      }, 400);
    }

    const filters = validation.data;
    const db = getDb(c.env.DB);

    // Get project ID from slug if provided
    let projectId: string | undefined;
    if (filters.project) {
      const { getProjectBySlug } = await import('../lib/db');
      const project = await getProjectBySlug(db, filters.project);
      projectId = project?.id;
    }

    const results = await getHealthChecks(db, {
      projectId,
      limit: filters.limit,
    });

    return c.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    console.error('Health check query error:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error',
    }, 500);
  }
});

export default health;
