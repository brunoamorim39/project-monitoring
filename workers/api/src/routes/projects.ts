import { Hono } from 'hono';
import { getDb, getAllProjects, getProjectBySlug, createProject, getDashboardStats } from '../lib/db';
import { createProjectSchema } from '@project-monitoring/shared';
import type { Env } from '../types';

const projects = new Hono<{ Bindings: Env }>();

// GET /api/v1/projects - Get all projects (admin only)
projects.get('/', async (c) => {
  try {
    const db = getDb(c.env.DB);
    const allProjects = await getAllProjects(db);

    return c.json({
      success: true,
      data: allProjects,
    });
  } catch (error: any) {
    console.error('Get projects error:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error',
    }, 500);
  }
});

// POST /api/v1/projects - Create new project (admin only)
projects.post('/', async (c) => {
  try {
    const body = await c.req.json();

    // Validate input
    const validation = createProjectSchema.safeParse(body);
    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      }, 400);
    }

    const data = validation.data;
    const db = getDb(c.env.DB);

    // Check if slug already exists
    const existing = await getProjectBySlug(db, data.slug);
    if (existing) {
      return c.json({
        success: false,
        error: 'Project slug already exists',
      }, 400);
    }

    // Create project
    const result = await createProject(db, {
      name: data.name,
      slug: data.slug,
      settings: data.settings ? JSON.stringify(data.settings) : undefined,
    });

    return c.json({
      success: true,
      data: {
        id: result.id,
        apiKey: result.apiKey,
      },
    });
  } catch (error: any) {
    console.error('Create project error:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error',
    }, 500);
  }
});

// GET /api/v1/projects/:slug - Get project by slug (admin only)
projects.get('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const db = getDb(c.env.DB);
    const project = await getProjectBySlug(db, slug);

    if (!project) {
      return c.json({
        success: false,
        error: 'Project not found',
      }, 404);
    }

    return c.json({
      success: true,
      data: project,
    });
  } catch (error: any) {
    console.error('Get project error:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error',
    }, 500);
  }
});

// GET /api/v1/stats - Get dashboard stats (admin only)
projects.get('/dashboard/stats', async (c) => {
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

export default projects;
