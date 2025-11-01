import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
import Layout from "~/components/Layout";
import { getEnv } from "~/utils/env.server";

// ============================================
// TypeScript Interfaces
// ============================================

interface CloudflareLogEvent {
  EventTimestampMs: number;
  Outcome: string;
  ScriptName: string;
  ScriptTags?: string[];
  Logs?: Array<{
    Level: string;
    Message: any[];
    TimestampMs: number;
  }>;
  Exceptions?: Array<{
    Name: string;
    Message: string;
    Timestamp: number;
    Stack?: string;
  }>;
  Request?: {
    URL: string;
    Method: string;
  };
  Response?: {
    Status: number;
  };
}

interface LogEntry {
  id: string;
  timestamp: number;
  level: string;
  message: string;
  hasException: boolean;
  stackTrace?: string;
}

interface RequestGroup {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  status: number;
  outcome: string;
  worker: string;
  environment?: string;
  logs: LogEntry[];
  hasErrors: boolean;
}

interface LoaderData {
  requests: RequestGroup[];
  workers: string[];
  total: number;
  date: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Basic authentication check
 */
function checkAuth(request: Request, env: any): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  const base64Credentials = authHeader.slice(6);
  const credentials = atob(base64Credentials);
  const [username, password] = credentials.split(':');

  return username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD;
}

/**
 * Get today's date path for R2 (YYYY/MM/DD)
 */
function getTodayPath(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * Decompress gzip data
 */
async function decompressGzip(stream: ReadableStream): Promise<string> {
  const decompressed = stream.pipeThrough(new DecompressionStream('gzip'));
  return await new Response(decompressed).text();
}

/**
 * Parse NDJSON logs from Cloudflare
 */
function parseNDJSON(text: string): CloudflareLogEvent[] {
  const lines = text.split('\n').filter(line => line.trim());
  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch (e) {
      console.error('Failed to parse log line:', e);
      return null;
    }
  }).filter((event): event is CloudflareLogEvent => event !== null);
}

/**
 * Group events into requests
 */
function groupByRequest(events: CloudflareLogEvent[]): RequestGroup[] {
  const requests: RequestGroup[] = [];

  for (const event of events) {
    const envTag = event.ScriptTags?.find(tag => tag.startsWith('environment:'));
    const environment = envTag?.split(':')[1];

    const logs: LogEntry[] = [];
    let hasErrors = false;

    // Process console.log entries
    if (event.Logs && event.Logs.length > 0) {
      for (const log of event.Logs) {
        const level = mapLogLevel(log.Level);
        if (level === 'error') hasErrors = true;

        logs.push({
          id: `${event.EventTimestampMs}-${log.TimestampMs}`,
          timestamp: log.TimestampMs,
          level,
          message: Array.isArray(log.Message) ? log.Message.join(' ') : String(log.Message),
          hasException: false,
        });
      }
    }

    // Process exceptions
    if (event.Exceptions && event.Exceptions.length > 0) {
      hasErrors = true;
      for (const exception of event.Exceptions) {
        logs.push({
          id: `${event.EventTimestampMs}-${exception.Timestamp}-exception`,
          timestamp: exception.Timestamp,
          level: 'error',
          message: `${exception.Name}: ${exception.Message}`,
          hasException: true,
          stackTrace: exception.Stack,
        });
      }
    }

    requests.push({
      id: `${event.EventTimestampMs}`,
      timestamp: event.EventTimestampMs,
      method: event.Request?.Method || 'UNKNOWN',
      url: event.Request?.URL || 'No URL',
      status: event.Response?.Status || 0,
      outcome: event.Outcome,
      worker: event.ScriptName,
      environment,
      logs,
      hasErrors,
    });
  }

  return requests;
}

/**
 * Map Cloudflare log levels to our standard levels
 */
function mapLogLevel(level: string): string {
  const levelMap: Record<string, string> = {
    log: 'info',
    warn: 'warn',
    error: 'error',
    debug: 'info',
  };
  return levelMap[level] || 'info';
}

// ============================================
// Remix Loader
// ============================================

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = getEnv(context);

  // In dev mode without R2 binding, return empty data (skip auth)
  if (!env.LOGS_BUCKET) {
    return json({
      requests: [],
      workers: [],
      total: 0,
      date: getTodayPath(),
    });
  }

  // Check authentication (only when R2 is available)
  if (!checkAuth(request, env)) {
    return new Response('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Worker Log Viewer"',
      },
    });
  }

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getTodayPath();
    const workerFilter = url.searchParams.get('worker');
    const quickFilter = url.searchParams.get('filter'); // 'errors', '5xx', 'exceptions'
    const statusFilter = url.searchParams.get('status'); // '2xx', '3xx', '4xx', '5xx'
    const methodFilter = url.searchParams.get('method'); // 'GET', 'POST', etc
    const searchQuery = url.searchParams.get('search');
    const limit = 500;

    // List log files for the specified date
    const prefix = `logs/${date}`;
    const list = await env.LOGS_BUCKET.list({ prefix, limit: 100 });

    if (list.objects.length === 0) {
      return json({
        requests: [],
        workers: [],
        total: 0,
        date,
      });
    }

    // Read and parse all log files
    const allEvents: CloudflareLogEvent[] = [];
    const workers = new Set<string>();

    for (const item of list.objects) {
      if (!item.key.endsWith('.log.gz')) continue;

      const object = await env.LOGS_BUCKET.get(item.key);
      if (!object) continue;

      const decompressed = await decompressGzip(object.body);
      const events = parseNDJSON(decompressed);
      allEvents.push(...events);
    }

    // Group by request
    let requests = groupByRequest(allEvents);

    // Track workers
    requests.forEach(req => workers.add(req.worker));

    // Apply filters
    requests = requests.filter(req => {
      // Worker filter
      if (workerFilter && req.worker !== workerFilter) return false;

      // Quick filters
      if (quickFilter === 'errors' && !req.hasErrors) return false;
      if (quickFilter === '5xx' && (req.status < 500 || req.status >= 600)) return false;
      if (quickFilter === 'exceptions') {
        const hasExceptions = req.logs.some(log => log.hasException);
        if (!hasExceptions) return false;
      }

      // Status filter
      if (statusFilter) {
        const status = req.status;
        if (statusFilter === '2xx' && (status < 200 || status >= 300)) return false;
        if (statusFilter === '3xx' && (status < 300 || status >= 400)) return false;
        if (statusFilter === '4xx' && (status < 400 || status >= 500)) return false;
        if (statusFilter === '5xx' && (status < 500 || status >= 600)) return false;
      }

      // Method filter
      if (methodFilter && req.method !== methodFilter) return false;

      // Search filter (search in URL and log messages)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const urlMatch = req.url.toLowerCase().includes(query);
        const logMatch = req.logs.some(log => log.message.toLowerCase().includes(query));
        if (!urlMatch && !logMatch) return false;
      }

      return true;
    });

    // Sort by timestamp (newest first)
    requests.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    const limitedRequests = requests.slice(0, limit);

    return json({
      requests: limitedRequests,
      workers: Array.from(workers).sort(),
      total: requests.length,
      date,
    });
  } catch (error) {
    console.error('Error reading logs:', error);
    // Return empty data with 500 status instead of throwing
    // This allows the UI to render gracefully with an error message
    return json(
      {
        requests: [],
        workers: [],
        total: 0,
        date: getTodayPath(),
      },
      { status: 500 }
    );
  }
}

// ============================================
// React Component
// ============================================

export default function Logs() {
  const initialData = useLoaderData<LoaderData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-expand exceptions on mount
  useEffect(() => {
    const exceptionsToExpand = new Set<string>();
    initialData.requests.forEach((req: any) => {
      if (req.logs.some((log: any) => log.hasException)) {
        exceptionsToExpand.add(req.id);
      }
    });
    setExpandedRequests(exceptionsToExpand);
  }, [initialData.requests]);

  // Auto-refresh interval (30 seconds)
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      window.location.reload();
      setLastRefresh(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case '/':
          e.preventDefault();
          searchInputRef.current?.focus();
          break;
        case 'e':
          e.preventDefault();
          handleQuickFilter('errors');
          break;
        case 'r':
          e.preventDefault();
          window.location.reload();
          break;
        case 'c':
          e.preventDefault();
          handleClearFilters();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Filter handlers
  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params, { replace: true });
  };

  const handleQuickFilter = (filter: string) => {
    const currentFilter = searchParams.get("filter");
    if (currentFilter === filter) {
      handleFilterChange("filter", "");
    } else {
      handleFilterChange("filter", filter);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      handleFilterChange("search", value);
    }, 300);
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setSearchParams({});
  };

  // Toggle request expansion
  const toggleRequest = (requestId: string) => {
    setExpandedRequests((prev) => {
      const next = new Set(prev);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", { hour12: false });
  };

  // Format relative time
  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return formatTime(timestamp);
  };

  // Get status color
  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "#238636"; // green
    if (status >= 300 && status < 400) return "#58a6ff"; // blue
    if (status >= 400 && status < 500) return "#d29922"; // orange
    if (status >= 500) return "#f85149"; // red
    return "#6e7681"; // gray
  };

  // Get level icon
  const getLevelIcon = (level: string) => {
    switch (level) {
      case "info": return "ℹ️";
      case "warn": return "⚠️";
      case "error": return "❌";
      default: return "○";
    }
  };

  // Get level color
  const getLevelColor = (level: string) => {
    switch (level) {
      case "info": return "#58a6ff";
      case "warn": return "#d29922";
      case "error": return "#f85149";
      default: return "#6e7681";
    }
  };

  // Highlight search terms
  const highlightText = (text: string, search: string) => {
    if (!search) return text;

    const parts = text.split(new RegExp(`(${search})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === search.toLowerCase() ?
        <mark key={i} style={{ background: '#d29922', color: '#0d1117', padding: '0 2px', borderRadius: '2px' }}>{part}</mark> :
        part
    );
  };

  return (
    <Layout>
      <style>{`
        .log-viewer-container {
          background: #0d1117;
          min-height: calc(100vh - 4rem);
          color: #c9d1d9;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
          display: flex;
          flex-direction: column;
          border-radius: 8px;
          overflow: hidden;
        }

        .log-header {
          background: #161b22;
          padding: 1rem;
          border-bottom: 1px solid #30363d;
        }

        .log-header h1 {
          font-size: 1.2rem;
          font-weight: 600;
          color: #58a6ff;
          margin-bottom: 0.5rem;
        }

        .log-header-info {
          font-size: 0.875rem;
          color: #6e7681;
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .log-controls {
          background: #161b22;
          padding: 1rem;
          border-bottom: 1px solid #30363d;
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .quick-filters {
          display: flex;
          gap: 0.5rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid #30363d;
          margin-bottom: 0.5rem;
        }

        .quick-filter-btn {
          background: #21262d;
          border: 1px solid #30363d;
          color: #c9d1d9;
          padding: 0.375rem 0.875rem;
          border-radius: 6px;
          font-size: 0.8125rem;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }

        .quick-filter-btn:hover {
          background: #30363d;
          border-color: #58a6ff;
        }

        .quick-filter-btn.active {
          background: #1f6feb;
          border-color: #1f6feb;
          color: #ffffff;
        }

        .log-controls select,
        .log-controls input[type="text"],
        .log-controls input[type="date"] {
          background: #0d1117;
          border: 1px solid #30363d;
          color: #c9d1d9;
          padding: 0.375rem 0.75rem;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .log-controls select:focus,
        .log-controls input[type="text"]:focus,
        .log-controls input[type="date"]:focus {
          outline: none;
          border-color: #58a6ff;
        }

        .log-controls input[type="text"] {
          flex: 1;
          min-width: 200px;
        }

        .log-controls button {
          background: #21262d;
          border: 1px solid #30363d;
          color: #c9d1d9;
          padding: 0.375rem 1rem;
          border-radius: 6px;
          font-size: 0.875rem;
          cursor: pointer;
          transition: background 0.2s;
        }

        .log-controls button:hover {
          background: #30363d;
        }

        .log-controls button.active {
          background: #238636;
          border-color: #238636;
          color: #ffffff;
        }

        .log-controls label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .log-controls input[type="checkbox"] {
          cursor: pointer;
        }

        .log-container {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
        }

        .request-entry {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
          margin-bottom: 0.75rem;
          overflow: hidden;
          transition: all 0.2s;
        }

        .request-entry.has-error {
          border-left: 3px solid #f85149;
        }

        .request-entry.has-exception {
          border-left: 3px solid #da3633;
          background: #1a1215;
        }

        .request-summary {
          padding: 0.875rem 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 1rem;
          font-size: 0.875rem;
          transition: background 0.2s;
        }

        .request-summary:hover {
          background: #0d1117;
        }

        .request-entry.expanded .request-summary {
          background: #0d1117;
        }

        .expand-icon {
          color: #6e7681;
          user-select: none;
          min-width: 12px;
          font-size: 0.75rem;
        }

        .request-method {
          font-weight: 700;
          font-family: 'Consolas', 'Monaco', monospace;
          min-width: 60px;
          font-size: 0.8125rem;
        }

        .request-method.GET { color: #238636; }
        .request-method.POST { color: #1f6feb; }
        .request-method.PUT { color: #d29922; }
        .request-method.DELETE { color: #f85149; }
        .request-method.PATCH { color: #a371f7; }

        .request-url {
          flex: 1;
          color: #c9d1d9;
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 0.8125rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .request-status {
          font-weight: 700;
          font-family: 'Consolas', 'Monaco', monospace;
          min-width: 45px;
          text-align: center;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.8125rem;
        }

        .request-time {
          color: #6e7681;
          font-size: 0.8125rem;
          min-width: 70px;
        }

        .log-badge {
          font-size: 0.75rem;
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
          font-weight: 500;
        }

        .log-worker-badge {
          background: #1f6feb;
          color: #ffffff;
        }

        .log-env-badge {
          background: #21262d;
          color: #c9d1d9;
        }

        .outcome-badge {
          font-size: 0.75rem;
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
          font-weight: 500;
        }

        .outcome-badge.ok {
          background: #1b3c1b;
          color: #3fb950;
        }

        .outcome-badge.exception {
          background: #3a1f1f;
          color: #f85149;
        }

        .outcome-badge.canceled {
          background: #352f1b;
          color: #d29922;
        }

        .request-logs {
          border-top: 1px solid #30363d;
          background: #0d1117;
          display: none;
          padding: 1rem;
        }

        .request-entry.expanded .request-logs {
          display: block;
        }

        .log-line {
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 0.8125rem;
          padding: 0.5rem 0.75rem;
          margin: 0.25rem 0;
          background: #161b22;
          border-radius: 4px;
          border-left: 3px solid;
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .log-line.info { border-left-color: #58a6ff; }
        .log-line.warn { border-left-color: #d29922; }
        .log-line.error { border-left-color: #f85149; }

        .log-line-icon {
          font-size: 1rem;
          line-height: 1;
        }

        .log-line-content {
          flex: 1;
        }

        .log-line-message {
          color: #c9d1d9;
          word-break: break-word;
        }

        .stack-trace {
          margin-top: 0.5rem;
          padding: 0.75rem;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 4px;
          font-size: 0.75rem;
          color: #8b949e;
          white-space: pre-wrap;
          overflow-x: auto;
        }

        .stack-trace-line {
          padding: 0.125rem 0;
        }

        .stack-trace-line:hover {
          background: #161b22;
        }

        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
          color: #6e7681;
        }

        .empty-state svg {
          width: 48px;
          height: 48px;
          margin: 0 auto 1rem;
          opacity: 0.5;
        }

        .shortcuts-hint {
          font-size: 0.75rem;
          color: #6e7681;
          font-style: italic;
        }

        .shortcuts-hint kbd {
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 3px;
          padding: 0.125rem 0.375rem;
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 0.6875rem;
        }
      `}</style>

      <div className="log-viewer-container">
        <div className="log-header">
          <h1>Worker Logs</h1>
          <div className="log-header-info">
            <span>{initialData.requests.length} requests loaded</span>
            <span>Total: {initialData.total}</span>
            {autoRefresh && <span>Auto-refresh: ON (last: {lastRefresh.toLocaleTimeString()})</span>}
            <span className="shortcuts-hint">
              Shortcuts: <kbd>/</kbd> search · <kbd>e</kbd> errors · <kbd>r</kbd> refresh · <kbd>c</kbd> clear
            </span>
          </div>
        </div>

        <div className="log-controls">
          <div className="quick-filters">
            <button
              className={`quick-filter-btn ${searchParams.get("filter") === "errors" ? "active" : ""}`}
              onClick={() => handleQuickFilter("errors")}
            >
              Errors Only
            </button>
            <button
              className={`quick-filter-btn ${searchParams.get("filter") === "5xx" ? "active" : ""}`}
              onClick={() => handleQuickFilter("5xx")}
            >
              5xx Only
            </button>
            <button
              className={`quick-filter-btn ${searchParams.get("filter") === "exceptions" ? "active" : ""}`}
              onClick={() => handleQuickFilter("exceptions")}
            >
              Exceptions
            </button>
          </div>

          <input
            type="date"
            value={initialData.date.replace(/\//g, "-")}
            onChange={(e) => {
              const [year, month, day] = e.target.value.split("-");
              handleFilterChange("date", `${year}/${month}/${day}`);
            }}
          />

          <select value={searchParams.get("worker") || ""} onChange={(e) => handleFilterChange("worker", e.target.value)}>
            <option value="">All Workers</option>
            {initialData.workers.map((worker: string) => (
              <option key={worker} value={worker}>
                {worker}
              </option>
            ))}
          </select>

          <select value={searchParams.get("status") || ""} onChange={(e) => handleFilterChange("status", e.target.value)}>
            <option value="">All Status</option>
            <option value="2xx">2xx Success</option>
            <option value="3xx">3xx Redirect</option>
            <option value="4xx">4xx Client Error</option>
            <option value="5xx">5xx Server Error</option>
          </select>

          <select value={searchParams.get("method") || ""} onChange={(e) => handleFilterChange("method", e.target.value)}>
            <option value="">All Methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </select>

          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search in URLs and logs..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
          />

          <label>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto-refresh (30s)
          </label>

          <button onClick={handleClearFilters}>Clear Filters</button>
        </div>

        <div className="log-container">
          {initialData.requests.length === 0 ? (
            <div className="empty-state">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No logs found for this date</p>
              <p style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>Try selecting a different date or adjusting your filters</p>
            </div>
          ) : (
            <>
              {initialData.requests.map((req: any) => {
                const isExpanded = expandedRequests.has(req.id);
                const hasException = req.logs.some((log: any) => log.hasException);

                return (
                  <div
                    key={req.id}
                    className={`request-entry ${isExpanded ? "expanded" : ""} ${req.hasErrors ? "has-error" : ""} ${hasException ? "has-exception" : ""}`}
                  >
                    <div className="request-summary" onClick={() => toggleRequest(req.id)}>
                      <span className="expand-icon">{isExpanded ? "▼" : "▶"}</span>
                      <span className={`request-method ${req.method}`}>{req.method}</span>
                      <span className="request-url" title={req.url}>
                        {highlightText(req.url, searchParams.get("search") || "")}
                      </span>
                      <span
                        className="request-status"
                        style={{
                          color: getStatusColor(req.status),
                          background: `${getStatusColor(req.status)}22`
                        }}
                      >
                        {req.status}
                      </span>
                      <span className={`outcome-badge ${req.outcome}`}>
                        {req.outcome}
                      </span>
                      <span className="log-badge log-worker-badge">{req.worker}</span>
                      {req.environment && <span className="log-badge log-env-badge">{req.environment}</span>}
                      <span className="request-time" title={new Date(req.timestamp).toISOString()}>
                        {formatRelativeTime(req.timestamp)}
                      </span>
                    </div>

                    <div className="request-logs">
                      {req.logs.map((log: any) => (
                        <div key={log.id} className={`log-line ${log.level}`}>
                          <span className="log-line-icon">{getLevelIcon(log.level)}</span>
                          <div className="log-line-content">
                            <div className="log-line-message">
                              {highlightText(log.message, searchParams.get("search") || "")}
                            </div>
                            {log.stackTrace && (
                              <div className="stack-trace">
                                {log.stackTrace.split('\n').map((line: string, i: number) => (
                                  <div key={i} className="stack-trace-line">{line}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
