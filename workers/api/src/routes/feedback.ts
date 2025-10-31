import { Hono } from 'hono';
import { getDb, createFeedback, getFeedback } from '../lib/db';
import { submitFeedbackSchema, feedbackQuerySchema } from '@project-monitoring/shared';
import type { Env } from '../types';

const feedback = new Hono<{ Bindings: Env }>();

// POST /api/v1/feedback - Submit feedback
feedback.post('/', async (c) => {
  try {
    const project = c.get('project');
    const body = await c.req.json();

    // Validate input
    const validation = submitFeedbackSchema.safeParse(body);
    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      }, 400);
    }

    const data = validation.data;
    const db = getDb(c.env.DB);

    // Create feedback entry
    const id = await createFeedback(db, project.id, {
      type: data.type,
      title: data.title,
      description: data.description,
      userEmail: data.user?.email,
      userName: data.user?.name,
      metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
    });

    return c.json({
      success: true,
      id,
    });
  } catch (error: any) {
    console.error('Feedback submission error:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error',
    }, 500);
  }
});

// GET /api/v1/feedback - Query feedback (admin only)
feedback.get('/', async (c) => {
  try {
    const query = c.req.query();
    const validation = feedbackQuerySchema.safeParse(query);

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

    const results = await getFeedback(db, {
      projectId,
      status: filters.status,
      type: filters.type,
      limit: filters.limit,
      offset: filters.offset,
    });

    return c.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    console.error('Feedback query error:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error',
    }, 500);
  }
});

export default feedback;
