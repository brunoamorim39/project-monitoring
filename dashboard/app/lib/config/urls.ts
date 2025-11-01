/**
 * Environment detection utilities
 */
export const isServer = typeof window === 'undefined';
export const isClient = !isServer;

/**
 * Detect local development environment
 */
export function isLocalDev(request?: Request): boolean {
  if (isServer && request) {
    try {
      const url = new URL(request.url);
      return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  } else if (isClient) {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }
  return false;
}

/**
 * Get the Worker API base URL based on environment
 */
export function getWorkerAPIBaseURL(env?: any, request?: Request): string {
  const localDev = isLocalDev(request);

  if (isServer) {
    if (localDev) {
      return 'http://localhost:8787';
    }
    // Server-side in preview/production needs absolute URL from env
    return env?.API_URL || 'https://project-monitoring.brunopamorim39.workers.dev';
  } else {
    // Client-side
    if (localDev) {
      return 'http://localhost:8787';
    }
    // Client-side in production uses window.ENV
    return (window as any).ENV?.API_URL || 'https://project-monitoring.brunopamorim39.workers.dev';
  }
}

/**
 * Build a full Worker API URL for a given endpoint
 */
export function buildAPIURL(endpoint: string, env?: any, request?: Request): string {
  const base = getWorkerAPIBaseURL(env, request);
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  return `${base}${cleanEndpoint}`;
}
