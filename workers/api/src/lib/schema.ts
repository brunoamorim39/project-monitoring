import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// ============================================
// Projects Table
// ============================================

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  apiKey: text('api_key').notNull().unique(),
  createdAt: integer('created_at').notNull(),
  settings: text('settings'), // JSON string
  lastHealthCheck: integer('last_health_check'),
});

// ============================================
// Feedback Table
// ============================================

export const feedback = sqliteTable('feedback', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  type: text('type').notNull(), // 'bug' | 'feature' | 'question'
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('open'), // 'open' | 'in_progress' | 'resolved' | 'wont_fix'
  priority: text('priority').notNull().default('medium'), // 'low' | 'medium' | 'high' | 'critical'
  userEmail: text('user_email'),
  userName: text('user_name'),
  metadata: text('metadata'), // JSON string
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  projectIdx: index('idx_feedback_project').on(table.projectId),
  statusIdx: index('idx_feedback_status').on(table.status),
  createdIdx: index('idx_feedback_created').on(table.createdAt),
}));

// ============================================
// Logs Table
// ============================================

export const logs = sqliteTable('logs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  level: text('level').notNull(), // 'info' | 'warn' | 'error' | 'critical'
  message: text('message').notNull(),
  context: text('context'), // JSON string
  timestamp: integer('timestamp').notNull(),
}, (table) => ({
  projectIdx: index('idx_logs_project').on(table.projectId),
  levelIdx: index('idx_logs_level').on(table.level),
  timestampIdx: index('idx_logs_timestamp').on(table.timestamp),
  projectTimestampIdx: index('idx_logs_project_timestamp').on(table.projectId, table.timestamp),
}));

// ============================================
// Errors Table
// ============================================

export const errors = sqliteTable('errors', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  message: text('message').notNull(),
  stackTrace: text('stack_trace'),
  errorType: text('error_type'),
  url: text('url'),
  userAgent: text('user_agent'),
  userContext: text('user_context'), // JSON string
  firstSeen: integer('first_seen').notNull(),
  lastSeen: integer('last_seen').notNull(),
  occurrenceCount: integer('occurrence_count').notNull().default(1),
  resolved: integer('resolved', { mode: 'boolean' }).notNull().default(false),
  metadata: text('metadata'), // JSON string
}, (table) => ({
  projectIdx: index('idx_errors_project').on(table.projectId),
  resolvedIdx: index('idx_errors_resolved').on(table.resolved),
  lastSeenIdx: index('idx_errors_last_seen').on(table.lastSeen),
}));

// ============================================
// Health Checks Table
// ============================================

export const healthChecks = sqliteTable('health_checks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  status: text('status').notNull(), // 'healthy' | 'degraded' | 'down'
  responseTime: integer('response_time'),
  metadata: text('metadata'), // JSON string
  timestamp: integer('timestamp').notNull(),
}, (table) => ({
  projectIdx: index('idx_health_project').on(table.projectId),
  timestampIdx: index('idx_health_timestamp').on(table.timestamp),
}));

// ============================================
// Notes Table
// ============================================

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  resourceType: text('resource_type').notNull(), // 'feedback' | 'error'
  resourceId: text('resource_id').notNull(),
  note: text('note').notNull(),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
});
