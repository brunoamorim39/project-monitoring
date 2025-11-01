/**
 * Pages Function to read Worker logs from R2
 * Logs are pushed by Cloudflare Logpush in NDJSON gzip format
 */

interface Env {
  LOGS_BUCKET: R2Bucket;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
}

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

interface ParsedLog {
  id: string;
  timestamp: number;
  level: string;
  message: string;
  worker: string;
  environment?: string;
  context?: {
    request?: {
      url: string;
      method: string;
    };
    response?: {
      status: number;
    };
    outcome?: string;
  };
}

/**
 * Basic authentication check
 */
function checkAuth(request: Request, env: Env): boolean {
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
 * Extract logs from Cloudflare log events
 */
function extractLogs(events: CloudflareLogEvent[]): ParsedLog[] {
  const logs: ParsedLog[] = [];

  for (const event of events) {
    // Extract environment from ScriptTags
    const envTag = event.ScriptTags?.find(tag => tag.startsWith('environment:'));
    const environment = envTag?.split(':')[1];

    // Process console.log entries
    if (event.Logs && event.Logs.length > 0) {
      for (const log of event.Logs) {
        logs.push({
          id: `${event.EventTimestampMs}-${log.TimestampMs}`,
          timestamp: log.TimestampMs,
          level: mapLogLevel(log.Level),
          message: Array.isArray(log.Message) ? log.Message.join(' ') : String(log.Message),
          worker: event.ScriptName,
          environment,
          context: {
            request: event.Request,
            response: event.Response,
            outcome: event.Outcome,
          },
        });
      }
    }

    // Process exceptions
    if (event.Exceptions && event.Exceptions.length > 0) {
      for (const exception of event.Exceptions) {
        logs.push({
          id: `${event.EventTimestampMs}-${exception.Timestamp}-exception`,
          timestamp: exception.Timestamp,
          level: 'error',
          message: `${exception.Name}: ${exception.Message}`,
          worker: event.ScriptName,
          environment,
          context: {
            request: event.Request,
            response: event.Response,
            outcome: event.Outcome,
            stackTrace: exception.Stack,
          },
        });
      }
    }
  }

  return logs;
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

/**
 * GET /api/logs
 * Query parameters:
 * - date: Date path (YYYY/MM/DD), defaults to today
 * - worker: Filter by worker name
 * - level: Filter by log level (info, warn, error, critical)
 * - search: Search in log messages
 * - limit: Maximum number of logs to return (default 500)
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Check authentication
  if (!checkAuth(request, env)) {
    return new Response('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Log Viewer"',
      },
    });
  }

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getTodayPath();
    const workerFilter = url.searchParams.get('worker');
    const levelFilter = url.searchParams.get('level');
    const searchQuery = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '500', 10);

    // List log files for the specified date
    const prefix = `logs/${date}`;
    const list = await env.LOGS_BUCKET.list({ prefix, limit: 100 });

    if (list.objects.length === 0) {
      return Response.json({ logs: [], workers: [], message: 'No logs found for this date' });
    }

    // Read and parse all log files
    const allLogs: ParsedLog[] = [];
    const workers = new Set<string>();

    for (const item of list.objects) {
      // Only process .gz files
      if (!item.key.endsWith('.log.gz')) {
        continue;
      }

      const object = await env.LOGS_BUCKET.get(item.key);
      if (!object) continue;

      // Decompress and parse
      const decompressed = await decompressGzip(object.body);
      const events = parseNDJSON(decompressed);
      const logs = extractLogs(events);

      // Track unique workers
      logs.forEach(log => workers.add(log.worker));

      // Apply filters
      const filteredLogs = logs.filter(log => {
        if (workerFilter && log.worker !== workerFilter) return false;
        if (levelFilter && log.level !== levelFilter) return false;
        if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      });

      allLogs.push(...filteredLogs);
    }

    // Sort by timestamp (newest first)
    allLogs.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    const limitedLogs = allLogs.slice(0, limit);

    return Response.json({
      logs: limitedLogs,
      workers: Array.from(workers).sort(),
      total: allLogs.length,
      displayed: limitedLogs.length,
      date,
    });
  } catch (error) {
    console.error('Error reading logs:', error);
    return Response.json(
      {
        error: 'Failed to read logs',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
};
