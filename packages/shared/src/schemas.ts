import { z } from 'zod';

// ============================================
// Submission Schemas
// ============================================

export const submitFeedbackSchema = z.object({
  environment: z.enum(['preview', 'production']).default('production'),
  type: z.enum(['bug', 'feature', 'question']),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  user: z.object({
    email: z.string().email().optional(),
    name: z.string().max(200).optional(),
    id: z.string().max(200).optional(),
  }).optional(),
  metadata: z.object({
    url: z.string().url().optional(),
    userAgent: z.string().max(500).optional(),
    customFields: z.record(z.any()).optional(),
  }).optional(),
});

export const submitLogsSchema = z.object({
  logs: z.array(
    z.object({
      environment: z.enum(['preview', 'production']).default('production'),
      level: z.enum(['info', 'warn', 'error', 'critical']),
      message: z.string().min(1).max(10000),
      timestamp: z.number().int().positive().optional(),
      context: z.record(z.any()).optional(),
    })
  ).min(1).max(100), // Max 100 logs per batch
});

export const reportErrorSchema = z.object({
  environment: z.enum(['preview', 'production']).default('production'),
  message: z.string().min(1).max(1000),
  errorType: z.string().max(200).optional(),
  stackTrace: z.string().max(50000).optional(),
  url: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
  user: z.record(z.any()).optional(),
  metadata: z.object({
    version: z.string().max(100).optional(),
    customFields: z.record(z.any()).optional(),
  }).optional(),
});

export const submitHealthCheckSchema = z.object({
  environment: z.enum(['preview', 'production']).default('production'),
  status: z.enum(['healthy', 'degraded', 'down']),
  responseTime: z.number().int().positive().optional(),
  metadata: z.object({
    services: z.record(z.string()).optional(),
    version: z.string().max(100).optional(),
  }).passthrough().optional(),
});

// ============================================
// Query Schemas
// ============================================

export const feedbackQuerySchema = z.object({
  project: z.string().optional(),
  environment: z.enum(['preview', 'production']).optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'wont_fix']).optional(),
  type: z.enum(['bug', 'feature', 'question']).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const logsQuerySchema = z.object({
  project: z.string().optional(),
  environment: z.enum(['preview', 'production']).optional(),
  level: z.enum(['info', 'warn', 'error', 'critical']).optional(),
  search: z.string().max(500).optional(),
  limit: z.coerce.number().int().positive().max(1000).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
  before: z.coerce.number().int().positive().optional(),
  after: z.coerce.number().int().positive().optional(),
});

export const errorsQuerySchema = z.object({
  project: z.string().optional(),
  environment: z.enum(['preview', 'production']).optional(),
  resolved: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const healthQuerySchema = z.object({
  project: z.string().optional(),
  environment: z.enum(['preview', 'production']).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================
// Project Management Schemas
// ============================================

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  settings: z.object({
    webhookUrl: z.string().url().optional(),
    logRetentionDays: z.number().int().positive().max(365).optional(),
    allowedOrigins: z.array(z.string()).optional(),
  }).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  settings: z.object({
    webhookUrl: z.string().url().optional(),
    logRetentionDays: z.number().int().positive().max(365).optional(),
    allowedOrigins: z.array(z.string()).optional(),
  }).optional(),
});

// ============================================
// Type exports from schemas
// ============================================

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
export type SubmitLogsInput = z.infer<typeof submitLogsSchema>;
export type ReportErrorInput = z.infer<typeof reportErrorSchema>;
export type SubmitHealthCheckInput = z.infer<typeof submitHealthCheckSchema>;
export type FeedbackQueryInput = z.infer<typeof feedbackQuerySchema>;
export type LogsQueryInput = z.infer<typeof logsQuerySchema>;
export type ErrorsQueryInput = z.infer<typeof errorsQuerySchema>;
export type HealthQueryInput = z.infer<typeof healthQuerySchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
