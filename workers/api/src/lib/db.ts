import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import * as schema from './schema';
import type { D1Database } from '@cloudflare/workers-types';

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

// ============================================
// Helper Functions
// ============================================

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function generateApiKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return `pm_${Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

// ============================================
// Project Queries
// ============================================

export async function getProjectByApiKey(db: ReturnType<typeof getDb>, apiKey: string) {
  return db.query.projects.findFirst({
    where: eq(schema.projects.apiKey, apiKey),
  });
}

export async function getProjectBySlug(db: ReturnType<typeof getDb>, slug: string) {
  return db.query.projects.findFirst({
    where: eq(schema.projects.slug, slug),
  });
}

export async function getAllProjects(db: ReturnType<typeof getDb>) {
  return db.query.projects.findMany({
    orderBy: [desc(schema.projects.createdAt)],
  });
}

export async function createProject(
  db: ReturnType<typeof getDb>,
  data: {
    name: string;
    slug: string;
    settings?: string;
  }
) {
  const id = generateId('proj');
  const apiKey = generateApiKey();
  const now = Date.now();

  await db.insert(schema.projects).values({
    id,
    name: data.name,
    slug: data.slug,
    apiKey,
    createdAt: now,
    settings: data.settings,
  });

  return { id, apiKey };
}

// ============================================
// Feedback Queries
// ============================================

export async function createFeedback(
  db: ReturnType<typeof getDb>,
  projectId: string,
  data: {
    type: string;
    title: string;
    description?: string;
    userEmail?: string;
    userName?: string;
    metadata?: string;
  }
) {
  const id = generateId('feedback');
  const now = Date.now();

  await db.insert(schema.feedback).values({
    id,
    projectId,
    type: data.type,
    title: data.title,
    description: data.description,
    userEmail: data.userEmail,
    userName: data.userName,
    metadata: data.metadata,
    status: 'open',
    priority: 'medium',
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

export async function getFeedback(
  db: ReturnType<typeof getDb>,
  filters: {
    projectId?: string;
    status?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }
) {
  const conditions = [];

  if (filters.projectId) {
    conditions.push(eq(schema.feedback.projectId, filters.projectId));
  }
  if (filters.status) {
    conditions.push(eq(schema.feedback.status, filters.status));
  }
  if (filters.type) {
    conditions.push(eq(schema.feedback.type, filters.type));
  }

  return db.query.feedback.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(schema.feedback.createdAt)],
    limit: filters.limit || 50,
    offset: filters.offset || 0,
  });
}

// ============================================
// Log Queries
// ============================================

export async function createLogs(
  db: ReturnType<typeof getDb>,
  projectId: string,
  logs: Array<{
    level: string;
    message: string;
    timestamp?: number;
    context?: string;
  }>
) {
  const values = logs.map(log => ({
    id: generateId('log'),
    projectId,
    level: log.level,
    message: log.message,
    context: log.context,
    timestamp: log.timestamp || Date.now(),
  }));

  await db.insert(schema.logs).values(values);
  return values.length;
}

export async function getLogs(
  db: ReturnType<typeof getDb>,
  filters: {
    projectId?: string;
    level?: string;
    before?: number;
    after?: number;
    limit?: number;
  }
) {
  const conditions = [];

  if (filters.projectId) {
    conditions.push(eq(schema.logs.projectId, filters.projectId));
  }
  if (filters.level) {
    conditions.push(eq(schema.logs.level, filters.level));
  }
  if (filters.before) {
    conditions.push(lte(schema.logs.timestamp, filters.before));
  }
  if (filters.after) {
    conditions.push(gte(schema.logs.timestamp, filters.after));
  }

  return db.query.logs.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(schema.logs.timestamp)],
    limit: filters.limit || 100,
  });
}

// ============================================
// Error Queries
// ============================================

export async function createOrUpdateError(
  db: ReturnType<typeof getDb>,
  projectId: string,
  data: {
    message: string;
    stackTrace?: string;
    errorType?: string;
    url?: string;
    userAgent?: string;
    userContext?: string;
    metadata?: string;
  }
) {
  // Generate a hash for deduplication
  const hashInput = `${data.message}|${data.stackTrace || ''}`;
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(hashInput)
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
  const errorId = `error_${hash}`;

  // Check if error already exists
  const existing = await db.query.errors.findFirst({
    where: eq(schema.errors.id, errorId),
  });

  const now = Date.now();

  if (existing) {
    // Update existing error
    await db
      .update(schema.errors)
      .set({
        lastSeen: now,
        occurrenceCount: existing.occurrenceCount + 1,
      })
      .where(eq(schema.errors.id, errorId));

    return { id: errorId, isNew: false };
  } else {
    // Create new error
    await db.insert(schema.errors).values({
      id: errorId,
      projectId,
      message: data.message,
      stackTrace: data.stackTrace,
      errorType: data.errorType,
      url: data.url,
      userAgent: data.userAgent,
      userContext: data.userContext,
      metadata: data.metadata,
      firstSeen: now,
      lastSeen: now,
      occurrenceCount: 1,
      resolved: false,
    });

    return { id: errorId, isNew: true };
  }
}

export async function getErrors(
  db: ReturnType<typeof getDb>,
  filters: {
    projectId?: string;
    resolved?: boolean;
    limit?: number;
    offset?: number;
  }
) {
  const conditions = [];

  if (filters.projectId) {
    conditions.push(eq(schema.errors.projectId, filters.projectId));
  }
  if (filters.resolved !== undefined) {
    conditions.push(eq(schema.errors.resolved, filters.resolved));
  }

  return db.query.errors.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(schema.errors.lastSeen)],
    limit: filters.limit || 50,
    offset: filters.offset || 0,
  });
}

// ============================================
// Health Check Queries
// ============================================

export async function createHealthCheck(
  db: ReturnType<typeof getDb>,
  projectId: string,
  data: {
    status: string;
    responseTime?: number;
    metadata?: string;
  }
) {
  const id = generateId('health');
  const now = Date.now();

  await db.insert(schema.healthChecks).values({
    id,
    projectId,
    status: data.status,
    responseTime: data.responseTime,
    metadata: data.metadata,
    timestamp: now,
  });

  // Update project's last health check
  await db
    .update(schema.projects)
    .set({ lastHealthCheck: now })
    .where(eq(schema.projects.id, projectId));

  return id;
}

export async function getHealthChecks(
  db: ReturnType<typeof getDb>,
  filters: {
    projectId?: string;
    limit?: number;
  }
) {
  const conditions = [];

  if (filters.projectId) {
    conditions.push(eq(schema.healthChecks.projectId, filters.projectId));
  }

  return db.query.healthChecks.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(schema.healthChecks.timestamp)],
    limit: filters.limit || 20,
  });
}

// ============================================
// Dashboard Stats
// ============================================

export async function getDashboardStats(db: ReturnType<typeof getDb>) {
  const [
    totalProjects,
    totalFeedback,
    totalErrors,
    openFeedback,
    unresolvedErrors,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(schema.projects),
    db.select({ count: sql<number>`count(*)` }).from(schema.feedback),
    db.select({ count: sql<number>`count(*)` }).from(schema.errors),
    db.select({ count: sql<number>`count(*)` }).from(schema.feedback).where(eq(schema.feedback.status, 'open')),
    db.select({ count: sql<number>`count(*)` }).from(schema.errors).where(eq(schema.errors.resolved, false)),
  ]);

  return {
    totalProjects: totalProjects[0]?.count || 0,
    totalFeedback: totalFeedback[0]?.count || 0,
    totalErrors: totalErrors[0]?.count || 0,
    openFeedback: openFeedback[0]?.count || 0,
    unresolvedErrors: unresolvedErrors[0]?.count || 0,
  };
}
