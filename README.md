# Project Monitoring Platform

A lightweight, self-hosted monitoring and feedback platform built on Cloudflare's stack. Monitor logs, errors, feedback, and system health across all your projects from one centralized dashboard.

## Features

- **Multi-project support**: Monitor all your projects from a single instance
- **Unified observability**: Logs, errors, feedback, and health checks in one place
- **Simple integration**: Add monitoring to any project with just a few lines of code
- **Embeddable widget**: Drop-in feedback widget for web applications
- **Real-time dashboard**: View and manage all telemetry data from a modern web UI
- **Edge-native**: Built on Cloudflare Workers, D1, and Pages for global performance
- **Self-hosted**: Full control over your data with no external SaaS dependencies

## Architecture

- **API**: Cloudflare Worker with Hono framework
- **Database**: Cloudflare D1 (SQLite at edge)
- **Dashboard**: Remix on Cloudflare Pages
- **Widget**: Vanilla JavaScript (<10KB)
- **Storage**: Cloudflare KV for rate limiting

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm
- Cloudflare account
- Wrangler CLI (`yarn install -g wrangler`)

### Using the Makefile (Recommended)

This project includes a convenient Makefile for common tasks:

```bash
# See all available commands
make help

# Initial setup (install deps + create .dev.vars)
make setup

# Create Cloudflare resources
make cf-create-all

# Run database migrations
make db-migrate

# Start development servers (API + Dashboard concurrently)
make dev

# Deploy to production
make deploy-prod
```

**Common Makefile Commands:**
- `make dev` - Start API Worker and Dashboard together
- `make db-update` - Generate and apply database migrations
- `make db-studio` - Open Drizzle Studio for visual DB exploration
- `make build` - Build all packages
- `make deploy-api` - Deploy API Worker to production
- `make clean` - Remove build artifacts

For the complete list of commands, run `make help`.

### Manual Installation (Alternative)

1. **Clone the repository**

```bash
git clone <your-repo-url>
cd project-monitoring
```

2. **Install dependencies**

```bash
yarn install
```

3. **Create Cloudflare D1 Database**

```bash
cd workers/api
wrangler d1 create project-monitoring
```

Copy the database ID and update `workers/api/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "project-monitoring"
database_id = "your-database-id-here"
```

4. **Create KV Namespace for Rate Limiting**

```bash
wrangler kv:namespace create project-monitoring-rate-limit-kv
```

Update `workers/api/wrangler.toml` with the KV namespace ID.

5. **Run Database Migrations**

```bash
make db-migrate
```

6. **Set up environment variables**

Create `workers/api/.dev.vars`:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

7. **Start development servers**

```bash
# Terminal 1: Start API Worker
make dev-api

# Terminal 2: Start Dashboard
make dev-dashboard

# Terminal 3: Build widget (optional)
make dev-widget
```

8. **Create your first project**

- Open the dashboard at `http://localhost:5173`
- Navigate to "Projects"
- Click "New Project"
- Enter project name and slug
- Save the API key shown after creation

## Deployment

### Deploy Worker API

```bash
cd workers/api
make deploy
```

Note the Worker URL (e.g., `https://project-monitoring.your-subdomain.workers.dev`)

### Deploy Dashboard

```bash
cd dashboard

# Update wrangler.toml with your Worker URL
# Update app/lib/api.ts with Worker URL

make deploy
```

### Build & Host Widget

```bash
cd widget
make build
```

Upload `build/widget.js` to Cloudflare Pages or your CDN.

## Usage

### 1. Embeddable Feedback Widget

Add to any HTML page:

```html
<script src="https://your-cdn.com/widget.js"></script>
<script>
  MonitorWidget.init({
    apiKey: 'your_project_api_key',
    apiUrl: 'https://your-worker-url.workers.dev',
    position: 'bottom-right', // 'bottom-left' | 'top-right' | 'top-left'
  });
</script>
```

### 2. Submit Logs

**JavaScript/TypeScript:**

```typescript
const API_KEY = 'your_project_api_key';
const API_URL = 'https://your-worker-url.workers.dev';

async function sendLog(level: 'info' | 'warn' | 'error' | 'critical', message: string, context?: any) {
  await fetch(`${API_URL}/api/v1/logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({
      logs: [{
        level,
        message,
        timestamp: Date.now(),
        context,
      }],
    }),
  });
}

// Usage
await sendLog('info', 'User logged in', { userId: '123', email: 'user@example.com' });
await sendLog('error', 'Payment failed', { orderId: 'abc', amount: 99.99 });
```

**Batch Logging (up to 100 logs per request):**

```typescript
await fetch(`${API_URL}/api/v1/logs`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  },
  body: JSON.stringify({
    logs: [
      { level: 'info', message: 'Request started', context: { requestId: 'req_1' } },
      { level: 'info', message: 'Database query executed', context: { requestId: 'req_1', duration: 45 } },
      { level: 'info', message: 'Request completed', context: { requestId: 'req_1', statusCode: 200 } },
    ],
  }),
});
```

### 3. Report Errors

**JavaScript/TypeScript:**

```typescript
async function reportError(error: Error, user?: any) {
  await fetch(`${API_URL}/api/v1/errors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({
      message: error.message,
      errorType: error.name,
      stackTrace: error.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      user: user ? { id: user.id, email: user.email } : undefined,
      metadata: {
        version: '1.0.0',
        environment: process.env.NODE_ENV,
      },
    }),
  });
}

// Usage with global error handler
window.addEventListener('error', (event) => {
  reportError(event.error);
});

// Usage in try-catch
try {
  await riskyOperation();
} catch (error) {
  await reportError(error as Error, currentUser);
  throw error; // Re-throw if needed
}
```

**React Error Boundary:**

```tsx
import { Component, ErrorInfo, ReactNode } from 'react';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportError(error, { componentStack: errorInfo.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
```

### 4. Health Checks

**Cloudflare Worker Cron:**

```typescript
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    const startTime = Date.now();

    try {
      // Check services
      await env.DB.prepare('SELECT 1').first();
      const dbOk = true;

      const responseTime = Date.now() - startTime;

      await fetch('https://your-worker-url.workers.dev/api/v1/health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': env.MONITOR_API_KEY,
        },
        body: JSON.stringify({
          status: 'healthy',
          responseTime,
          metadata: {
            services: {
              database: 'ok',
            },
          },
        }),
      });
    } catch (error) {
      await fetch('https://your-worker-url.workers.dev/api/v1/health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': env.MONITOR_API_KEY,
        },
        body: JSON.stringify({
          status: 'down',
          metadata: { error: error.message },
        }),
      });
    }
  }
};
```

Add to `wrangler.toml`:

```toml
[triggers]
crons = ["*/5 * * * *"] # Every 5 minutes
```

### 5. Submit Feedback Programmatically

```typescript
await fetch(`${API_URL}/api/v1/feedback`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  },
  body: JSON.stringify({
    type: 'bug', // 'bug' | 'feature' | 'question'
    title: 'Button not working on checkout page',
    description: 'When I click the submit button, nothing happens.',
    user: {
      email: 'user@example.com',
      name: 'John Doe',
    },
    metadata: {
      url: window.location.href,
      userAgent: navigator.userAgent,
      customFields: {
        userId: '123',
        plan: 'premium',
      },
    },
  }),
});
```

## API Reference

### Base URL

```
https://your-worker-url.workers.dev/api/v1
```

### Authentication

All submission endpoints require an API key in the header:

```
X-API-Key: your_project_api_key
```

Admin/query endpoints require Basic Auth (username/password set in Worker environment).

### Endpoints

#### POST /api/v1/feedback
Submit user feedback (bug reports, feature requests, questions)

#### POST /api/v1/logs
Submit log entries (supports batch up to 100 logs)

#### POST /api/v1/errors
Report errors with automatic deduplication

#### POST /api/v1/health
Submit health check status

#### GET /api/v1/admin/feedback
Query feedback entries (admin only)

#### GET /api/v1/admin/logs
Query log entries (admin only)

#### GET /api/v1/admin/errors
Query error entries (admin only)

#### GET /api/v1/admin/health
Query health check history (admin only)

#### GET /api/v1/admin/projects
List all projects (admin only)

#### POST /api/v1/admin/projects
Create new project (admin only)

#### GET /api/v1/admin/stats
Get dashboard statistics (admin only)

## Rate Limits

- **Feedback**: 100 requests per hour per project
- **Logs**: 1000 requests per hour per project
- **Errors**: 500 requests per hour per project
- **Health**: 200 requests per hour per project

Rate limits are enforced using Cloudflare KV.

## Data Retention

Default retention periods (configurable per project):

- **Logs**: 7 days
- **Errors**: 90 days (until marked resolved)
- **Feedback**: Indefinite
- **Health Checks**: 30 days

## Security

- API keys are randomly generated and stored securely
- Admin dashboard protected with Basic Auth
- CORS configurable per project
- Input validation on all endpoints
- SQL injection protection via Drizzle ORM
- Rate limiting to prevent abuse

## Development

### Project Structure

```
project-monitoring/
├── workers/api/          # Cloudflare Worker API
│   ├── src/
│   │   ├── routes/       # API route handlers
│   │   ├── lib/          # Database queries & helpers
│   │   ├── middleware/   # Auth, CORS, rate limiting
│   │   └── index.ts      # Main Worker entry
│   └── drizzle/          # DB schema & migrations
├── dashboard/            # Remix admin dashboard
│   └── app/
│       ├── routes/       # Dashboard pages
│       ├── components/   # React components
│       └── lib/          # API client
├── widget/               # Embeddable feedback widget
│   └── src/
│       └── index.ts      # Widget source
└── packages/shared/      # Shared TypeScript types
    └── src/
        ├── types.ts      # Type definitions
        └── schemas.ts    # Zod validation schemas
```

### Available Scripts

```bash
# Root
make dev-api          # Start API Worker
make dev-dashboard    # Start dashboard
make dev-widget       # Build widget in watch mode
make build            # Build all packages
make deploy:api       # Deploy API Worker
make deploy:dashboard # Deploy dashboard
make db-generate      # Generate Drizzle migrations
make db-migrate       # Run migrations

# Individual packages
cd workers/api && yarn dev
cd dashboard && yarn dev
cd widget && make build
```

## Troubleshooting

### Database migrations fail

Make sure you've created the D1 database and updated the ID in `wrangler.toml`:

```bash
wrangler d1 create project-monitoring
```

### Rate limiting not working

Ensure KV namespace is created and bound in `wrangler.toml`:

```bash
wrangler kv:namespace create project-monitoring-rate-limit-kv
```

### Dashboard shows authentication errors

Check that `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set in your Worker environment:

```bash
wrangler secret put ADMIN_USERNAME
wrangler secret put ADMIN_PASSWORD
```

### Widget not loading

Verify the `apiUrl` in the widget initialization matches your deployed Worker URL.

## Contributing

Contributions welcome! Please open an issue or PR.

## License

MIT

## Support

For issues or questions, please open a GitHub issue.
