// API client for communicating with the Worker API

const API_BASE_URL = typeof window !== 'undefined'
  ? window.ENV?.API_URL || 'http://localhost:8787'
  : process.env.API_URL || 'http://localhost:8787';

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
  username?: string;
  password?: string;
}

async function fetchAPI<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  // Build URL with query params
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }

  // Get credentials from environment
  const username = typeof window !== 'undefined'
    ? window.ENV?.ADMIN_USERNAME
    : options.username;
  const password = typeof window !== 'undefined'
    ? window.ENV?.ADMIN_PASSWORD
    : options.password;

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

export function createServerAPI(username: string, password: string) {
  return {
    getStats: () => fetchAPI('/api/v1/admin/stats', { username, password }),
    getProjects: () => fetchAPI('/api/v1/admin/projects', { username, password }),
    getProject: (slug: string) => fetchAPI(`/api/v1/admin/projects/${slug}`, { username, password }),
    createProject: (data: any) =>
      fetchAPI('/api/v1/admin/projects', {
        method: 'POST',
        body: JSON.stringify(data),
        username,
        password,
      }),
    getFeedback: (params?: Record<string, any>) =>
      fetchAPI('/api/v1/admin/feedback', { params, username, password }),
    getLogs: (params?: Record<string, any>) =>
      fetchAPI('/api/v1/admin/logs', { params, username, password }),
    getErrors: (params?: Record<string, any>) =>
      fetchAPI('/api/v1/admin/errors', { params, username, password }),
    getHealthChecks: (params?: Record<string, any>) =>
      fetchAPI('/api/v1/admin/health', { params, username, password }),
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
