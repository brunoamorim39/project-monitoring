import { Hono } from 'hono';
import { getDb, createOrUpdateError, getErrors } from '../lib/db';
import { reportErrorSchema, errorsQuerySchema } from '@project-monitoring/shared';
import type { Env } from '../types';

const errors = new Hono<{ Bindings: Env }>();

// POST /api/v1/errors - Report error
errors.post('/', async (c) => {
  try {
    const project = c.get('project');
    const body = await c.req.json();

    // Validate input
    const validation = reportErrorSchema.safeParse(body);
    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      }, 400);
    }

    const data = validation.data;
    const db = getDb(c.env.DB);

    // Create or update error entry (with deduplication)
    const result = await createOrUpdateError(db, project.id, {
      message: data.message,
      stackTrace: data.stackTrace,
      errorType: data.errorType,
      url: data.url,
      userAgent: data.userAgent,
      userContext: data.user ? JSON.stringify(data.user) : undefined,
      metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
    });

    return c.json({
      success: true,
      id: result.id,
      isNew: result.isNew,
    });
  } catch (error: any) {
    console.error('Error reporting error:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error',
    }, 500);
  }
});

// GET /api/v1/errors - Query errors (admin only)
errors.get('/', async (c) => {
  try {
    const query = c.req.query();
    const validation = errorsQuerySchema.safeParse(query);

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

    const results = await getErrors(db, {
      projectId,
      resolved: filters.resolved,
      limit: filters.limit,
      offset: filters.offset,
    });

    return c.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    console.error('Error query error:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error',
    }, 500);
  }
});

export default errors;
