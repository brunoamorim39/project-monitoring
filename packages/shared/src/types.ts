// ============================================
// Database Types
// ============================================

export interface Project {
  id: string;
  name: string;
  slug: string;
  apiKey: string;
  createdAt: number;
  settings?: string; // JSON string
  lastHealthCheck?: number;
}

export interface ProjectSettings {
  webhookUrl?: string;
  logRetentionDays?: number;
  allowedOrigins?: string[];
}

export interface Feedback {
  id: string;
  projectId: string;
  type: 'bug' | 'feature' | 'question';
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'wont_fix';
  priority: 'low' | 'medium' | 'high' | 'critical';
  userEmail?: string;
  userName?: string;
  metadata?: string; // JSON string
  createdAt: number;
  updatedAt: number;
}

export interface FeedbackMetadata {
  url?: string;
  userAgent?: string;
  customFields?: Record<string, any>;
}

export interface Log {
  id: string;
  projectId: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  message: string;
  context?: string; // JSON string
  timestamp: number;
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  customFields?: Record<string, any>;
  [key: string]: any;
}

export interface ErrorEntry {
  id: string;
  projectId: string;
  message: string;
  stackTrace?: string;
  errorType?: string;
  url?: string;
  userAgent?: string;
  userContext?: string; // JSON string
  firstSeen: number;
  lastSeen: number;
  occurrenceCount: number;
  resolved: boolean;
  metadata?: string; // JSON string
}

export interface ErrorUserContext {
  userId?: string;
  email?: string;
  [key: string]: any;
}

export interface HealthCheck {
  id: string;
  projectId: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  metadata?: string; // JSON string
  timestamp: number;
}

export interface HealthMetadata {
  services?: Record<string, string>;
  version?: string;
  [key: string]: any;
}

export interface Note {
  id: string;
  resourceType: 'feedback' | 'error';
  resourceId: string;
  note: string;
  createdBy?: string;
  createdAt: number;
}

// ============================================
// API Request Types
// ============================================

export interface SubmitFeedbackRequest {
  type: 'bug' | 'feature' | 'question';
  title: string;
  description?: string;
  user?: {
    email?: string;
    name?: string;
    id?: string;
  };
  metadata?: {
    url?: string;
    userAgent?: string;
    customFields?: Record<string, any>;
  };
}

export interface SubmitLogsRequest {
  logs: Array<{
    level: 'info' | 'warn' | 'error' | 'critical';
    message: string;
    timestamp?: number;
    context?: Record<string, any>;
  }>;
}

export interface ReportErrorRequest {
  message: string;
  errorType?: string;
  stackTrace?: string;
  url?: string;
  userAgent?: string;
  user?: {
    id?: string;
    email?: string;
    [key: string]: any;
  };
  metadata?: {
    version?: string;
    environment?: string;
    customFields?: Record<string, any>;
  };
}

export interface SubmitHealthCheckRequest {
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  metadata?: {
    services?: Record<string, string>;
    version?: string;
    [key: string]: any;
  };
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface FeedbackResponse {
  success: boolean;
  id: string;
}

export interface LogsResponse {
  success: boolean;
  inserted: number;
}

export interface ErrorResponse {
  success: boolean;
  id: string;
  isNew: boolean;
}

export interface HealthCheckResponse {
  success: boolean;
}

// ============================================
// Query Types
// ============================================

export interface FeedbackQuery {
  project?: string;
  status?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface LogsQuery {
  project?: string;
  level?: string;
  limit?: number;
  before?: number;
  after?: number;
}

export interface ErrorsQuery {
  project?: string;
  resolved?: boolean;
  limit?: number;
  offset?: number;
}

export interface HealthQuery {
  project?: string;
  limit?: number;
}

// ============================================
// Dashboard Types
// ============================================

export interface DashboardStats {
  totalProjects: number;
  totalFeedback: number;
  totalErrors: number;
  totalLogs: number;
  openFeedback: number;
  unresolvedErrors: number;
  healthyProjects: number;
  degradedProjects: number;
}

export interface ProjectWithStats extends Project {
  feedbackCount: number;
  errorCount: number;
  logCount: number;
  healthStatus?: 'healthy' | 'degraded' | 'down';
}
