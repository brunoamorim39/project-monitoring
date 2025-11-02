import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, useSearchParams, useRevalidator } from "@remix-run/react";
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
  Event?: {
    Request?: {
      URL: string;
      Method: string;
    };
    Response?: {
      Status: number;
    };
  };
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
  date: string; // Keep for backward compatibility
  range: string; // Time range string (e.g., "now-30m")
  rangeFrom: number; // Start timestamp in ms
  rangeTo: number; // End timestamp in ms
  serverTime: number;
  expandedRequestIds: string[];
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get today's date path for R2 (YYYYMMDD)
 */
function getTodayPath(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Parse relative time range (e.g., "now-30m", "now-1h") into Date range
 */
function parseRelativeRange(range: string): [Date, Date] {
  const now = new Date();
  const match = range.match(/^now-(\d+)([mhd])$/);

  if (!match) {
    // If invalid format, default to last 30 minutes
    const from = new Date(now.getTime() - 30 * 60 * 1000);
    return [from, now];
  }

  const amount = parseInt(match[1], 10);
  const unit = match[2];

  let milliseconds = 0;
  switch (unit) {
    case 'm': // minutes
      milliseconds = amount * 60 * 1000;
      break;
    case 'h': // hours
      milliseconds = amount * 60 * 60 * 1000;
      break;
    case 'd': // days
      milliseconds = amount * 24 * 60 * 60 * 1000;
      break;
  }

  const from = new Date(now.getTime() - milliseconds);
  return [from, now];
}

/**
 * Generate R2 date prefixes (YYYYMMDD) for a date range
 * Always uses day-level prefixes - files are filtered by timestamp after listing
 * Returns array of prefixes to search (can span multiple days)
 */
function generateDatePrefixes(from: Date, to: Date): string[] {
  const prefixes: string[] = [];
  const current = new Date(from);

  // Set to start of day
  current.setUTCHours(0, 0, 0, 0);

  // Generate prefix for each day in range
  while (current <= to) {
    const year = current.getUTCFullYear();
    const month = String(current.getUTCMonth() + 1).padStart(2, '0');
    const day = String(current.getUTCDate()).padStart(2, '0');
    prefixes.push(`${year}${month}${day}`);

    // Move to next day
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return prefixes;
}

/**
 * Format time range for display in UI
 */
function formatTimeRange(range: string, from?: Date, to?: Date): string {
  // For relative ranges, show friendly names
  const relativeLabels: Record<string, string> = {
    'now-30m': 'Last 30 minutes',
    'now-1h': 'Last 1 hour',
    'now-4h': 'Last 4 hours',
    'now-12h': 'Last 12 hours',
    'now-24h': 'Last 24 hours',
    'now-7d': 'Last 7 days',
  };

  if (relativeLabels[range]) {
    return relativeLabels[range];
  }

  // For custom ranges, format the dates
  if (from && to) {
    const formatDate = (d: Date) => {
      const month = d.toLocaleString('en-US', { month: 'short' });
      const day = d.getDate();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${month} ${day}, ${hours}:${minutes}`;
    };

    return `${formatDate(from)} - ${formatDate(to)}`;
  }

  return 'Last 30 minutes'; // fallback
}

/**
 * Parse timestamp from R2 filename
 * Format: YYYYMMDD/HH/timestamp_random.log.gz
 * Example: 20251102/14/1730556300_abc123.log.gz → 1730556300000 (ms)
 */
function parseTimestampFromFilename(filename: string): number | null {
  // Extract filename from path (get last part after /)
  const parts = filename.split('/');
  const basename = parts[parts.length - 1];

  // Extract timestamp (part before first underscore)
  const match = basename.match(/^(\d+)_/);
  if (match) {
    const timestampSeconds = parseInt(match[1], 10);
    return timestampSeconds * 1000; // Convert to milliseconds
  }

  return null;
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
      method: event.Event?.Request?.Method || 'UNKNOWN',
      url: event.Event?.Request?.URL || 'No URL',
      status: event.Event?.Response?.Status || 0,
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
// TimeRangeSelector Component
// ============================================

interface TimeRangeSelectorProps {
  currentRange: string;
  onApply: (range: string) => void;
}

function TimeRangeSelector({ currentRange, onApply }: TimeRangeSelectorProps) {
  const presets = [
    { label: 'Last 30 minutes', value: 'now-30m' },
    { label: 'Last 1 hour', value: 'now-1h' },
    { label: 'Last 4 hours', value: 'now-4h' },
    { label: 'Last 12 hours', value: 'now-12h' },
    { label: 'Last 24 hours', value: 'now-24h' },
    { label: 'Last 7 days', value: 'now-7d' },
  ];

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ color: '#8b949e', fontSize: '14px', fontWeight: 500 }}>Time range:</span>
      {presets.map(preset => {
        const isActive = currentRange === preset.value;
        return (
          <button
            key={preset.value}
            onClick={() => onApply(preset.value)}
            style={{
              background: isActive ? '#1f6feb' : '#21262d',
              color: isActive ? '#ffffff' : '#c9d1d9',
              border: `1px solid ${isActive ? '#1f6feb' : '#30363d'}`,
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = '#30363d';
                e.currentTarget.style.borderColor = '#8b949e';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = '#21262d';
                e.currentTarget.style.borderColor = '#30363d';
              }
            }}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// Remix Loader
// ============================================

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = getEnv(context);

  // In dev mode without R2 binding, return empty data
  if (!env.LOGS_BUCKET) {
    const [rangeFrom, rangeTo] = parseRelativeRange('now-30m');
    return json({
      requests: [],
      workers: [],
      total: 0,
      date: getTodayPath(),
      range: 'now-30m',
      rangeFrom: rangeFrom.getTime(),
      rangeTo: rangeTo.getTime(),
      serverTime: Date.now(),
      expandedRequestIds: [],
    });
  }

  // Auth is handled at the Pages Function level in functions/[[path]].ts
  // If we reach here, the request is already authenticated

  try {
    const url = new URL(request.url);

    // Get time range from URL params (default to last 30 minutes)
    const range = url.searchParams.get('range') || 'now-30m';
    const [rangeFrom, rangeTo] = parseRelativeRange(range);
    const rangeFromMs = rangeFrom.getTime();
    const rangeToMs = rangeTo.getTime();

    const workerFilter = url.searchParams.get('worker');
    const quickFilter = url.searchParams.get('filter'); // 'errors', '5xx', 'exceptions'
    const statusFilter = url.searchParams.get('status'); // '2xx', '3xx', '4xx', '5xx'
    const methodFilter = url.searchParams.get('method'); // 'GET', 'POST', etc
    const searchQuery = url.searchParams.get('search');
    const limit = 500;

    // Generate date prefixes for the time range
    const datePrefixes = generateDatePrefixes(rangeFrom, rangeTo);

    console.log('[Loader] Time range:', range);
    console.log('[Loader] From:', rangeFrom.toISOString());
    console.log('[Loader] To:', rangeTo.toISOString());
    console.log('[Loader] Date prefixes:', datePrefixes);

    // Collect all log files from relevant date prefixes (with pagination)
    const allObjects: any[] = [];
    for (const prefix of datePrefixes) {
      let cursor: string | undefined = undefined;
      let hasMore = true;
      let totalForPrefix = 0;

      // Handle pagination (up to 5000 files per prefix as safety limit)
      while (hasMore && totalForPrefix < 5000) {
        const list: any = await env.LOGS_BUCKET.list({
          prefix,
          limit: 1000,
          cursor,
        });

        allObjects.push(...list.objects);
        totalForPrefix += list.objects.length;

        hasMore = list.truncated;
        cursor = list.cursor;

        if (!hasMore) break;
      }

      console.log(`[Loader] Found ${totalForPrefix} objects for prefix ${prefix}`);
    }

    console.log('[Loader] Total objects found:', allObjects.length);

    // Filter files by timestamp BEFORE downloading
    const relevantFiles = allObjects.filter(item => {
      if (!item.key.endsWith('.log.gz')) return false;

      const fileTimestamp = parseTimestampFromFilename(item.key);
      if (!fileTimestamp) return true; // Include if we can't parse (safety fallback)

      // Only include files where timestamp falls within our range
      // Add 5-minute buffer on each side to account for log batching
      const bufferMs = 5 * 60 * 1000;
      return fileTimestamp >= (rangeFromMs - bufferMs) && fileTimestamp <= (rangeToMs + bufferMs);
    });

    console.log(`[Loader] Filtered to ${relevantFiles.length} relevant files (from ${allObjects.length} total)`);

    if (relevantFiles.length === 0) {
      return json({
        requests: [],
        workers: [],
        total: 0,
        date: getTodayPath(),
        range,
        rangeFrom: rangeFromMs,
        rangeTo: rangeToMs,
        serverTime: Date.now(),
        expandedRequestIds: [],
      });
    }

    // Process files in parallel (batch of 10 at a time to avoid overwhelming)
    const allEvents: CloudflareLogEvent[] = [];
    const workers = new Set<string>();
    const batchSize = 10;

    for (let i = 0; i < relevantFiles.length; i += batchSize) {
      const batch = relevantFiles.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (item) => {
          try {
            const object = await env.LOGS_BUCKET.get(item.key);
            if (!object) return [];

            const decompressed = await decompressGzip(object.body);
            const events = parseNDJSON(decompressed);

            // Filter events by timestamp range
            return events.filter(event => {
              return event.EventTimestampMs >= rangeFromMs && event.EventTimestampMs <= rangeToMs;
            });
          } catch (error) {
            console.error(`[Loader] Error processing file ${item.key}:`, error);
            return []; // Return empty array on error, don't crash
          }
        })
      );

      // Collect successful results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          allEvents.push(...result.value);
        }
      }
    }

    console.log('[Loader] Total events in time range:', allEvents.length);

    // Group by request
    let requests = groupByRequest(allEvents);

    console.log('[Loader] Grouped into requests:', requests.length);

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

    // Calculate which requests should be auto-expanded (those with exceptions)
    const expandedRequestIds = limitedRequests
      .filter(req => req.logs.some(log => log.hasException))
      .map(req => req.id);

    return json({
      requests: limitedRequests,
      workers: Array.from(workers).sort(),
      total: requests.length,
      date: getTodayPath(), // Keep for backward compatibility
      range,
      rangeFrom: rangeFromMs,
      rangeTo: rangeToMs,
      serverTime: Date.now(),
      expandedRequestIds,
    });
  } catch (error) {
    console.error('Error reading logs:', error);
    // Return empty data with 500 status instead of throwing
    // This allows the UI to render gracefully with an error message
    const [rangeFrom, rangeTo] = parseRelativeRange('now-30m');
    return json(
      {
        requests: [],
        workers: [],
        total: 0,
        date: getTodayPath(),
        range: 'now-30m',
        rangeFrom: rangeFrom.getTime(),
        rangeTo: rangeTo.getTime(),
        serverTime: Date.now(),
        expandedRequestIds: [],
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

  // Defensive checks for SSR - ensure data is always defined
  const safeData = {
    requests: initialData?.requests || [],
    workers: initialData?.workers || [],
    total: initialData?.total || 0,
    date: initialData?.date || getTodayPath(),
    range: initialData?.range || 'now-30m',
    rangeFrom: initialData?.rangeFrom || Date.now() - 30 * 60 * 1000,
    rangeTo: initialData?.rangeTo || Date.now(),
    serverTime: initialData?.serverTime || Date.now(),
    expandedRequestIds: initialData?.expandedRequestIds || [],
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(
    new Set(safeData.expandedRequestIds)
  );
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date(safeData.serverTime));
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-refresh interval (30 seconds)
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      revalidator.revalidate();
      setLastRefresh(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, revalidator]);

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
          revalidator.revalidate();
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
        .log-controls input[type="text"] {
          background: #0d1117;
          border: 1px solid #30363d;
          color: #c9d1d9;
          padding: 0.375rem 0.75rem;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .log-controls select:focus,
        .log-controls input[type="text"]:focus {
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
            <span style={{ color: '#58a6ff', fontWeight: 500 }}>
              {formatTimeRange(safeData.range, new Date(safeData.rangeFrom), new Date(safeData.rangeTo))}
            </span>
            <span>{safeData.requests.length} requests loaded</span>
            <span>Total: {safeData.total}</span>
            {autoRefresh && <span suppressHydrationWarning>Auto-refresh: ON (last: {lastRefresh.toLocaleTimeString()})</span>}
            <span className="shortcuts-hint">
              Shortcuts: <kbd>/</kbd> search · <kbd>e</kbd> errors · <kbd>r</kbd> refresh · <kbd>c</kbd> clear
            </span>
          </div>
        </div>

        <div className="log-controls">
          <TimeRangeSelector
            currentRange={safeData.range}
            onApply={(range) => {
              const params = new URLSearchParams(searchParams);
              params.set('range', range);
              params.delete('date'); // Remove old date param
              setSearchParams(params, { replace: true });
            }}
          />

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

          <select value={searchParams.get("worker") || ""} onChange={(e) => handleFilterChange("worker", e.target.value)}>
            <option value="">All Workers</option>
            {safeData.workers.map((worker: string) => (
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
          {safeData.requests.length === 0 ? (
            <div className="empty-state">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No logs found for this date</p>
              <p style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>Try selecting a different date or adjusting your filters</p>
            </div>
          ) : (
            <>
              {safeData.requests.map((req: any) => {
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
