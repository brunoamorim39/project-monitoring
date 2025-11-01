// API client for communicating with the Worker API
import { getWorkerAPIBaseURL } from './config/urls';

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
  username?: string;
  password?: string;
  baseURL?: string;
}

async function fetchAPI<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params, username: optUsername, password: optPassword, baseURL, ...fetchOptions} = options;

  // Determine API base URL
  const API_BASE_URL = baseURL ||
    (typeof window !== 'undefined'
      ? (window as any).ENV?.API_URL || 'http://localhost:8787'
      : 'http://localhost:8787');

  // Build URL with query params
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      // Skip undefined, null, and empty string values
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }

  // Get credentials from environment
  const username = typeof window !== 'undefined'
    ? window.ENV?.ADMIN_USERNAME
    : optUsername;
  const password = typeof window !== 'undefined'
    ? window.ENV?.ADMIN_PASSWORD
    : optPassword;

  if (!username || !password) {
    throw new Error('Missing API key');
  }

  const credentials = btoa(`${username}:${password}`);

  const response = await fetch(url.toString(), {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`,
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================
// Helper for server-side loaders
// ============================================

export function createServerAPI(
  username: string,
  password: string,
  request?: Request,
  context?: any
) {
  // Get environment and determine base URL
  const env = context?.env || context?.cloudflare?.env || {};
  const baseURL = getWorkerAPIBaseURL(env, request);

  return {
    getStats: () => fetchAPI('/api/v1/admin/stats', { username, password, baseURL }),
    getProjects: () => fetchAPI('/api/v1/admin/projects', { username, password, baseURL }),
    getProject: (slug: string) => fetchAPI(`/api/v1/admin/projects/${slug}`, { username, password, baseURL }),
    createProject: (data: any) =>
      fetchAPI('/api/v1/admin/projects', {
        method: 'POST',
        body: JSON.stringify(data),
        username,
        password,
        baseURL,
      }),
    getFeedback: (params?: Record<string, any>) =>
      fetchAPI('/api/v1/admin/feedback', { params, username, password, baseURL }),
    getLogs: (params?: Record<string, any>) =>
      fetchAPI('/api/v1/admin/logs', { params, username, password, baseURL }),
    getErrors: (params?: Record<string, any>) =>
      fetchAPI('/api/v1/admin/errors', { params, username, password, baseURL }),
    getHealthChecks: (params?: Record<string, any>) =>
      fetchAPI('/api/v1/admin/health', { params, username, password, baseURL }),
  };
}

// ============================================
// API Methods (client-side, uses window.ENV)
// ============================================

export const api = {
  // Dashboard stats
  getStats: () => fetchAPI('/api/v1/admin/stats'),

  // Projects
  getProjects: () => fetchAPI('/api/v1/admin/projects'),
  getProject: (slug: string) => fetchAPI(`/api/v1/admin/projects/${slug}`),
  createProject: (data: any) =>
    fetchAPI('/api/v1/admin/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Feedback
  getFeedback: (params?: Record<string, any>) =>
    fetchAPI('/api/v1/admin/feedback', { params }),

  // Logs
  getLogs: (params?: Record<string, any>) =>
    fetchAPI('/api/v1/admin/logs', { params }),

  // Errors
  getErrors: (params?: Record<string, any>) =>
    fetchAPI('/api/v1/admin/errors', { params }),

  // Health checks
  getHealthChecks: (params?: Record<string, any>) =>
    fetchAPI('/api/v1/admin/health', { params }),
};
