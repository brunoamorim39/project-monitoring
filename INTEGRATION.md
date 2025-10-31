# Integration Guide - Project Monitoring Platform

Complete guide for integrating your application with the project-monitoring platform. Designed for copy-paste integration in under 5 minutes.

---

## Quick Reference

**API Endpoint:** `POST https://your-api.workers.dev/api/v1/logs`
**Authentication:** API Key via `X-API-Key` header
**Rate Limit:** 1000 requests/hour per project
**Max Batch Size:** 100 logs per request

**Minimal Example (5 lines):**
```typescript
await fetch(MONITORING_API_URL + '/api/v1/logs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': MONITORING_API_KEY },
  body: JSON.stringify({
    logs: [{ environment: 'production', level: 'info', message: 'Hello from my app!' }]
  })
});
```

---

## 5-Minute Quick Start

### Step 1: Get Your API Key

1. Create a project in the monitoring dashboard at `/projects`
2. Copy your project's API key (shown after creation)

### Step 2: Configure Environment Variables

Add to your `.dev.vars` (Cloudflare Workers) or environment:

```bash
MONITORING_API_KEY=your_project_api_key_here
MONITORING_API_URL=https://project-monitoring.your-domain.workers.dev
ENVIRONMENT=production  # or 'preview'
```

### Step 3: Copy the Helper Function

```typescript
/**
 * Send a log to the monitoring platform
 * @param level - Log severity: info, warn, error, critical
 * @param message - Log message (max 10,000 chars)
 * @param context - Optional metadata object
 */
async function sendLog(
  level: 'info' | 'warn' | 'error' | 'critical',
  message: string,
  context?: Record<string, any>
) {
  // Gracefully skip if monitoring isn't configured
  if (!env.MONITORING_API_KEY) {
    return;
  }

  try {
    await fetch(`${env.MONITORING_API_URL}/api/v1/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.MONITORING_API_KEY,
      },
      body: JSON.stringify({
        logs: [{
          environment: env.ENVIRONMENT || 'production',
          level,
          message,
          timestamp: Date.now(),
          context,
        }],
      }),
    });
  } catch (error) {
    // Don't let monitoring failures crash your app
    console.error('[Monitoring] Failed to send log:', error);
  }
}
```

### Step 4: Start Logging

```typescript
// Info log
await sendLog('info', 'User logged in', { userId: '123', method: 'oauth' });

// Error log
try {
  await riskyOperation();
} catch (error) {
  await sendLog('error', 'Operation failed', {
    error: error.message,
    stack: error.stack,
    operationId: '456',
  });
}

// Critical log
await sendLog('critical', 'Payment processor down', { service: 'stripe' });
```

### Step 5: View Logs

Navigate to `/logs` in the dashboard to see your logs with filtering, search, and environment selection.

---

## API Reference

### Logs Endpoint

**Endpoint:** `POST /api/v1/logs`
**Purpose:** Submit application logs for monitoring and debugging

#### Request Headers

```
Content-Type: application/json
X-API-Key: your_project_api_key
```

#### Request Body

```typescript
{
  logs: [
    {
      environment: 'preview' | 'production',  // Default: 'production'
      level: 'info' | 'warn' | 'error' | 'critical',  // Required
      message: string,  // Required, max 10,000 chars
      timestamp?: number,  // Optional, Unix ms (defaults to server time)
      context?: Record<string, any>  // Optional, any JSON structure
    }
    // ... up to 100 logs per batch
  ]
}
```

#### Response (Success)

```typescript
{
  success: true,
  inserted: number  // Number of logs inserted
}
```

#### Response (Error)

```typescript
{
  success: false,
  error: string  // Error message
}
```

#### Validation Rules

- **logs array**: 1-100 items required
- **level**: Must be one of: `info`, `warn`, `error`, `critical`
- **message**: 1-10,000 characters
- **environment**: Must be `preview` or `production`
- **timestamp**: Positive integer (Unix milliseconds)
- **context**: Any valid JSON object

#### Example Curl

```bash
curl -X POST https://your-api.workers.dev/api/v1/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "logs": [{
      "environment": "production",
      "level": "error",
      "message": "Database connection failed",
      "timestamp": 1234567890000,
      "context": {
        "database": "postgres",
        "host": "db.example.com",
        "error": "Connection timeout"
      }
    }]
  }'
```

---

### Errors Endpoint

**Endpoint:** `POST /api/v1/errors`
**Purpose:** Track application errors with stack traces and automatic deduplication

#### Request Body

```typescript
{
  environment: 'preview' | 'production',  // Default: 'production'
  message: string,  // Error message (required, 1-1000 chars)
  errorType?: string,  // Error type/name (e.g., "TypeError", max 200 chars)
  stackTrace?: string,  // Full stack trace (max 50000 chars)
  url?: string,  // URL where error occurred (max 2000 chars)
  userAgent?: string,  // User agent string (max 500 chars)
  user?: Record<string, any>,  // User context (userId, email, etc.)
  metadata?: {
    version?: string,  // Application version (max 100 chars)
    customFields?: Record<string, any>  // Any additional context
  }
}
```

#### Example

```typescript
try {
  // Your code that might throw
  await riskyOperation();
} catch (error) {
  await fetch(`${env.MONITORING_API_URL}/api/v1/errors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': env.MONITORING_API_KEY,
    },
    body: JSON.stringify({
      environment: env.ENVIRONMENT || 'production',
      message: error.message,
      errorType: error.name,  // "TypeError", "ReferenceError", etc.
      stackTrace: error.stack,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      user: {
        userId: currentUser?.id,
        email: currentUser?.email,
      },
      metadata: {
        version: '1.0.0',
        customFields: {
          route: request.url,
          component: 'UserDashboard',
        },
      },
    }),
  });
}
```

**Note:** Errors are automatically deduplicated based on `message`, `stackTrace`, and `errorType`. Duplicate errors increment the occurrence count instead of creating new entries.

---

### Feedback Endpoint

**Endpoint:** `POST /api/v1/feedback`
**Purpose:** Collect user feedback

#### Request Body

```typescript
{
  feedback: [{
    environment: 'preview' | 'production',
    type: 'bug' | 'feature' | 'improvement' | 'other',
    message: string,
    email?: string,  // User email
    url?: string,  // Page URL
    userAgent?: string,
    context?: Record<string, any>
  }]
}
```

---

### Feedback Widget Integration

The platform includes a ready-to-use feedback widget that can be embedded in your application. The widget provides a floating button that users can click to submit bugs, feature requests, or questions.

#### Installation

Add this script to your HTML (before closing `</body>` tag):

```html
<script src="https://your-domain.workers.dev/widget.js"></script>
<script>
  MonitorWidget.init({
    apiKey: 'your_project_api_key_here',
    apiUrl: 'https://your-domain.workers.dev',
    position: 'bottom-right', // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
    theme: 'auto' // 'light' | 'dark' | 'auto'
  });
</script>
```

#### Widget Features

- **Floating button** that opens feedback modal on click
- **Type selection**: Bug, Feature Request, Question
- **Auto-captures**: URL, user agent, timestamp
- **Optional user info**: Name and email fields
- **Automatic environment detection** (preview/production based on hostname)
- **Screenshot capture** (coming soon)

#### Configuration Options

```typescript
MonitorWidget.init({
  apiKey: string,              // Required: Your project API key
  apiUrl: string,              // Required: Monitoring API endpoint
  position?: string,           // Optional: Widget position (default: 'bottom-right')
  theme?: 'light' | 'dark' | 'auto',  // Optional: Theme (default: 'auto')
  user?: {                     // Optional: Pre-fill user info
    name?: string,
    email?: string
  },
  environment?: 'preview' | 'production',  // Optional: Override auto-detection
  customStyles?: CSSProperties // Optional: Custom widget styles
});
```

#### Example with User Context

```html
<script src="https://your-domain.workers.dev/widget.js"></script>
<script>
  // Get current user from your app
  const currentUser = {
    name: 'John Doe',
    email: 'john@example.com'
  };

  MonitorWidget.init({
    apiKey: 'proj_abc123_xyz789',
    apiUrl: 'https://project-monitoring.your-domain.workers.dev',
    position: 'bottom-right',
    theme: 'dark',
    user: currentUser,
    environment: 'production'
  });
</script>
```

#### Programmatic Usage

You can also trigger the widget programmatically:

```typescript
// Open the widget
MonitorWidget.open();

// Close the widget
MonitorWidget.close();

// Pre-fill feedback type
MonitorWidget.open({ type: 'bug' });

// Pre-fill message
MonitorWidget.open({
  type: 'bug',
  message: 'Describe the issue here'
});
```

#### Building the Widget

The widget source code is in `widget/src/index.ts`. To build:

```bash
cd widget
npm install
npm run build
```

Built file will be in `widget/build/widget.js` - deploy this to your CDN or Workers static assets.

---

### Health Checks Endpoint

**Endpoint:** `POST /api/v1/health`
**Purpose:** Monitor service health and uptime

#### Request Body

```typescript
{
  environment: 'preview' | 'production',  // Default: 'production'
  status: 'healthy' | 'degraded' | 'down',  // Required
  responseTime?: number,  // Response time in milliseconds (positive integer)
  metadata?: {
    services?: Record<string, string>,  // Map of service names to status
    version?: string,  // Application version (max 100 chars)
    [key: string]: any  // Additional custom fields
  }
}
```

#### Example

```typescript
const start = Date.now();
const dbHealthy = await checkDatabase();
const apiHealthy = await checkAPI();
const responseTime = Date.now() - start;

await fetch(`${env.MONITORING_API_URL}/api/v1/health`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': env.MONITORING_API_KEY,
  },
  body: JSON.stringify({
    environment: env.ENVIRONMENT || 'production',
    status: (dbHealthy && apiHealthy) ? 'healthy' : (dbHealthy || apiHealthy) ? 'degraded' : 'down',
    responseTime,
    metadata: {
      services: {
        database: dbHealthy ? 'healthy' : 'down',
        api: apiHealthy ? 'healthy' : 'down',
        cache: 'healthy',
      },
      version: '1.0.0',
      region: 'us-east-1',
    },
  }),
});
```

**Tip:** Use the `metadata.services` object to track individual service statuses, and set the overall `status` based on your health check logic (e.g., all healthy = `healthy`, some failing = `degraded`, critical services down = `down`).

---

## Production Patterns

### Batch Logger with Auto-Flush

For high-traffic applications, batch logs to reduce API calls:

```typescript
class LogBatcher {
  private queue: any[] = [];
  private readonly MAX_BATCH_SIZE = 100;
  private readonly FLUSH_INTERVAL = 1000; // 1 second
  private flushTimer?: ReturnType<typeof setTimeout>;
  private isFlushing = false;

  constructor(
    private apiUrl: string,
    private apiKey: string,
    private environment: string
  ) {}

  /**
   * Add a log to the queue
   */
  add(level: string, message: string, context?: any) {
    this.queue.push({
      environment: this.environment,
      level,
      message,
      timestamp: Date.now(),
      context,
    });

    // Flush immediately if queue is full
    if (this.queue.length >= this.MAX_BATCH_SIZE) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  /**
   * Schedule a flush after the interval
   */
  private scheduleFlush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL);
  }

  /**
   * Flush all queued logs
   */
  async flush() {
    if (this.isFlushing || this.queue.length === 0) {
      return;
    }

    this.isFlushing = true;

    // Clear the flush timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Take up to MAX_BATCH_SIZE logs from queue
    const batch = this.queue.splice(0, this.MAX_BATCH_SIZE);

    try {
      await fetch(`${this.apiUrl}/api/v1/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({ logs: batch }),
      });
    } catch (error) {
      console.error('[Monitoring] Failed to flush batch:', error);
      // Optionally: re-queue failed logs
    } finally {
      this.isFlushing = false;

      // If more logs accumulated while flushing, schedule another flush
      if (this.queue.length > 0) {
        this.scheduleFlush();
      }
    }
  }

  /**
   * Force flush and wait for completion
   */
  async shutdown() {
    await this.flush();
  }
}

// Usage
const logger = new LogBatcher(
  env.MONITORING_API_URL,
  env.MONITORING_API_KEY,
  env.ENVIRONMENT
);

// Add logs (queued automatically)
logger.add('info', 'User action', { action: 'click' });
logger.add('warn', 'Slow query', { duration: 1500 });

// Flush on Worker shutdown
addEventListener('fetch', (event) => {
  event.waitUntil(logger.shutdown());
});
```

---

### Environment-Aware Configuration

```typescript
interface MonitoringConfig {
  apiKey: string;
  apiUrl: string;
  environment: 'preview' | 'production';
  enabled: boolean;
  batchSize: number;
  flushInterval: number;
}

function getMonitoringConfig(env: any): MonitoringConfig {
  return {
    apiKey: env.MONITORING_API_KEY || '',
    apiUrl: env.MONITORING_API_URL || '',
    environment: env.ENVIRONMENT || 'production',
    // Auto-disable if no API key configured
    enabled: !!(env.MONITORING_API_KEY && env.MONITORING_API_URL),
    batchSize: parseInt(env.MONITORING_BATCH_SIZE || '50'),
    flushInterval: parseInt(env.MONITORING_FLUSH_INTERVAL || '1000'),
  };
}

// Usage
const config = getMonitoringConfig(env);

if (config.enabled) {
  const logger = new LogBatcher(
    config.apiUrl,
    config.apiKey,
    config.environment
  );
  // Use logger...
}
```

---

### Wrapping Existing Console Methods

Automatically send console.error calls to monitoring:

```typescript
// Save original methods
const originalError = console.error;
const originalWarn = console.warn;

// Wrap console.error
console.error = (...args: any[]) => {
  // Call original
  originalError(...args);

  // Send to monitoring
  sendLog('error', args.join(' '), {
    stack: new Error().stack,
    args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)),
  }).catch(() => {
    // Ignore monitoring errors
  });
};

// Wrap console.warn
console.warn = (...args: any[]) => {
  originalWarn(...args);
  sendLog('warn', args.join(' ')).catch(() => {});
};
```

---

### Error Boundary Integration

For Cloudflare Workers error handling:

```typescript
async function handleRequest(request: Request, env: any): Promise<Response> {
  try {
    // Your handler logic
    return await handleRoute(request, env);
  } catch (error) {
    // Log error to monitoring
    await sendLog('error', `Unhandled error: ${error.message}`, {
      url: request.url,
      method: request.method,
      error: error.message,
      stack: error.stack,
      headers: Object.fromEntries(request.headers),
    }).catch(() => {});

    // Return error response
    return new Response('Internal Server Error', { status: 500 });
  }
}
```

---

## Complete Cloudflare Worker Example

Full working example showing all patterns:

```typescript
interface Env {
  MONITORING_API_KEY: string;
  MONITORING_API_URL: string;
  ENVIRONMENT: 'preview' | 'production';
}

class MonitoringLogger {
  private config: {
    apiKey: string;
    apiUrl: string;
    environment: string;
    enabled: boolean;
  };

  constructor(env: Env) {
    this.config = {
      apiKey: env.MONITORING_API_KEY || '',
      apiUrl: env.MONITORING_API_URL || '',
      environment: env.ENVIRONMENT || 'production',
      enabled: !!(env.MONITORING_API_KEY && env.MONITORING_API_URL),
    };
  }

  async log(
    level: 'info' | 'warn' | 'error' | 'critical',
    message: string,
    context?: any
  ) {
    if (!this.config.enabled) return;

    try {
      await fetch(`${this.config.apiUrl}/api/v1/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
        },
        body: JSON.stringify({
          logs: [{
            environment: this.config.environment,
            level,
            message,
            timestamp: Date.now(),
            context,
          }],
        }),
      });
    } catch (error) {
      console.error('[Monitoring] Send failed:', error);
    }
  }

  info(message: string, context?: any) {
    return this.log('info', message, context);
  }

  warn(message: string, context?: any) {
    return this.log('warn', message, context);
  }

  error(message: string, context?: any) {
    return this.log('error', message, context);
  }

  critical(message: string, context?: any) {
    return this.log('critical', message, context);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const logger = new MonitoringLogger(env);
    const start = Date.now();

    try {
      // Log incoming request
      await logger.info('Request received', {
        url: request.url,
        method: request.method,
        userAgent: request.headers.get('user-agent'),
      });

      // Handle request
      const response = await handleRoute(request, env);

      // Log response
      const duration = Date.now() - start;
      await logger.info('Request completed', {
        url: request.url,
        status: response.status,
        duration,
      });

      return response;
    } catch (error) {
      // Log error
      const duration = Date.now() - start;
      await logger.error('Request failed', {
        url: request.url,
        error: error.message,
        stack: error.stack,
        duration,
      });

      return new Response('Internal Server Error', { status: 500 });
    }
  },

  // Scheduled handler (cron jobs)
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const logger = new MonitoringLogger(env);

    try {
      await logger.info('Cron job started', {
        cron: event.cron,
        scheduledTime: event.scheduledTime,
      });

      // Your cron logic
      await runScheduledTask(env);

      await logger.info('Cron job completed');
    } catch (error) {
      await logger.error('Cron job failed', {
        error: error.message,
        stack: error.stack,
      });
    }
  },
};

async function handleRoute(request: Request, env: Env): Promise<Response> {
  // Your route handling logic
  return new Response('Hello World');
}

async function runScheduledTask(env: Env): Promise<void> {
  // Your scheduled task logic
}
```

---

## Best Practices

### When to Use Each Log Level

**INFO** - General informational messages:
- User logged in
- API request received
- Cron job started
- Database query completed

**WARN** - Potentially problematic situations:
- Slow query (> 1s)
- Deprecated API usage
- Rate limit approaching
- Retry attempt

**ERROR** - Error conditions that don't stop the application:
- API call failed (with retry)
- Validation error
- Third-party service timeout
- Non-critical operation failed

**CRITICAL** - Severe errors requiring immediate attention:
- Database unavailable
- Payment processor down
- Data corruption detected
- Security breach attempt

---

### Context Field Recommendations

**Good Context Examples:**

```typescript
// User action
{
  userId: '123',
  action: 'purchase',
  itemId: '456',
  amount: 99.99,
  currency: 'USD'
}

// Error context
{
  error: error.message,
  stack: error.stack,
  url: request.url,
  method: request.method,
  userId: user?.id,
  retryCount: 3
}

// Performance context
{
  operation: 'database_query',
  duration: 1250, // ms
  query: 'SELECT * FROM users WHERE...',
  resultCount: 42
}
```

**Avoid:**
- Large objects (> 1MB in context)
- Sensitive data (passwords, tokens, full credit cards)
- Circular references
- Binary data

---

### Rate Limit Management

**Current Limits:**
- 1000 requests/hour per project
- 100 logs per batch

**Strategies to Stay Within Limits:**

1. **Use Batching:**
```typescript
// Bad: 100 API calls for 100 logs
for (const log of logs) {
  await sendLog(log.level, log.message);
}

// Good: 1 API call for 100 logs
await sendBatchLogs(logs);
```

2. **Sample High-Volume Logs:**
```typescript
// Log only 10% of info messages
if (level === 'info' && Math.random() > 0.1) {
  return; // Skip this log
}
await sendLog(level, message, context);
```

3. **Prioritize by Level:**
```typescript
// Always log errors and critical, sample info/warn
const shouldLog = level === 'critical' || level === 'error' || Math.random() < 0.1;
if (shouldLog) {
  await sendLog(level, message, context);
}
```

---

### Environment Tagging Strategy

**Recommended Approach:**

```typescript
// Set at Worker level
const environment = env.ENVIRONMENT; // 'preview' or 'production'

// Tag all logs with environment
await sendLog(level, message, {
  ...context,
  // environment is set automatically in request body
});
```

**Benefits:**
- Filter preview vs production issues separately
- Track environment-specific behavior
- Identify preview-only bugs before production

**Usage:**
- Use `preview` for all non-production deployments
- Use `production` for live user-facing environment
- Filter in dashboard: `/logs?environment=production`

---

## Troubleshooting

### Common Errors

#### 401 Unauthorized

**Error:** `{ success: false, error: "Unauthorized" }`

**Causes:**
- Missing `X-API-Key` header
- Invalid API key
- API key for wrong project

**Fix:**
```typescript
// Verify headers
headers: {
  'Content-Type': 'application/json',
  'X-API-Key': env.MONITORING_API_KEY, // Check this is set
}

// Verify API key format (starts with project slug)
console.log('Using API key:', env.MONITORING_API_KEY);
```

---

#### 400 Bad Request

**Error:** `{ success: false, error: "Validation error: ..." }`

**Causes:**
- Invalid log level
- Message too long (> 10,000 chars)
- Invalid environment value
- Missing required fields

**Fix:**
```typescript
// Validate before sending
if (!['info', 'warn', 'error', 'critical'].includes(level)) {
  throw new Error(`Invalid log level: ${level}`);
}

if (message.length > 10000) {
  message = message.substring(0, 10000) + '... (truncated)';
}

if (!['preview', 'production'].includes(environment)) {
  environment = 'production'; // default
}
```

---

#### 429 Too Many Requests

**Error:** `{ success: false, error: "Rate limit exceeded" }`

**Causes:**
- More than 1000 requests/hour
- Not using batching effectively

**Fix:**
```typescript
// Implement batching (see Production Patterns section)
// Use sampling for high-volume logs
// Cache and flush periodically

// Add retry with backoff
async function sendLogWithRetry(level, message, context) {
  let retries = 3;
  while (retries > 0) {
    try {
      await sendLog(level, message, context);
      return;
    } catch (error) {
      if (error.status === 429) {
        retries--;
        await new Promise(r => setTimeout(r, 5000 * (4 - retries))); // 5s, 10s, 15s
      } else {
        throw error;
      }
    }
  }
}
```

---

#### Network Errors

**Error:** `TypeError: fetch failed` or timeout

**Causes:**
- API endpoint unreachable
- Network connectivity issues
- Timeout (default 30s)

**Fix:**
```typescript
// Add timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

try {
  await fetch(url, {
    ...options,
    signal: controller.signal,
  });
} catch (error) {
  if (error.name === 'AbortError') {
    console.error('[Monitoring] Request timeout');
  }
} finally {
  clearTimeout(timeoutId);
}

// Verify API URL
console.log('Monitoring API URL:', env.MONITORING_API_URL);
// Should be: https://your-domain.workers.dev
```

---

#### Context Not Appearing in Dashboard

**Issue:** Logs appear but context is missing

**Causes:**
- Context not valid JSON
- Context contains circular references
- Context too large (> 1MB)

**Fix:**
```typescript
// Sanitize context before sending
function sanitizeContext(context: any): any {
  try {
    // Test if serializable
    JSON.stringify(context);
    return context;
  } catch (error) {
    // Fallback to string representation
    return { _raw: String(context), _error: 'Failed to serialize' };
  }
}

await sendLog(level, message, sanitizeContext(context));
```

---

## FAQ

**Q: Can I use this with non-Cloudflare platforms?**
A: Yes! The API is platform-agnostic. Use standard HTTP fetch from Node.js, Deno, or any HTTP client.

**Q: What happens if the monitoring API is down?**
A: With the error handling shown in examples, your app continues normally. Monitoring failures are logged to console but don't affect functionality.

**Q: Should I await log calls?**
A: For critical logs (error/critical), yes. For info logs in high-traffic scenarios, consider fire-and-forget or batching.

**Q: How do I test integration locally?**
A: Use Wrangler dev mode with `.dev.vars`. Logs will go to your preview environment if `ENVIRONMENT=preview`.

**Q: Can I send logs from the frontend?**
A: Not directly (exposes API key). Send logs to your backend, then forward to monitoring API.

**Q: How long are logs retained?**
A: Currently indefinite. Future versions may add retention policies.

---

## Next Steps

1. **Create a project** in the dashboard (`/projects`)
2. **Copy your API key**
3. **Add environment variables** to your app
4. **Copy the helper function** from Quick Start
5. **Send your first log**
6. **Check the dashboard** (`/logs`)

For advanced usage, see the **Production Patterns** section for batching, error handling, and performance optimization.

---

**Need Help?** Check the troubleshooting section or review the complete Cloudflare Worker example above.
