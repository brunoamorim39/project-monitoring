import { Hono } from 'hono';
import { getDb, createLogs, getLogs } from '../lib/db';
import { submitLogsSchema, logsQuerySchema } from '@project-monitoring/shared';
import type { Env } from '../types';

const logs = new Hono<{ Bindings: Env }>();

// POST /api/v1/logs - Submit logs (batch)
logs.post('/', async (c) => {
  try {
    const project = c.get('project');
    const body = await c.req.json();

    // Validate input
    const validation = submitLogsSchema.safeParse(body);
    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      }, 400);
    }

    const data = validation.data;
    const db = getDb(c.env.DB);

    // Create log entries
    const logsData = data.logs.map(log => ({
      level: log.level,
      message: log.message,
      timestamp: log.timestamp,
      context: log.context ? JSON.stringify(log.context) : undefined,
    }));

    const inserted = await createLogs(db, project.id, logsData);

    return c.json({
      success: true,
      inserted,
    });
  } catch (error: any) {
    console.error('Log submission error:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error',
    }, 500);
  }
});

// GET /api/v1/logs - Query logs (admin only)
logs.get('/', async (c) => {
  try {
    const query = c.req.query();
    const validation = logsQuerySchema.safeParse(query);

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

    const results = await getLogs(db, {
      projectId,
      level: filters.level,
      before: filters.before,
      after: filters.after,
      limit: filters.limit,
    });

    return c.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    console.error('Log query error:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error',
    }, 500);
  }
});

export default logs;
