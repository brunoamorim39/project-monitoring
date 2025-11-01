# Worker Log Viewer

Simple, beautiful log viewer for Cloudflare Workers using R2 storage and Logpush.

## What is This?

A minimal dashboard to view logs from your Cloudflare Workers. Uses Cloudflare's native **Logpush** feature to send logs to R2, then displays them in a GitHub-style dark theme interface.

**No complex setup. No database. No SDK to integrate. Just pure Cloudflare.**

## Features

- ✅ **Automatic log collection** via Cloudflare Logpush
- ✅ **GitHub-style dark theme** interface
- ✅ **Date picker** to browse historical logs
- ✅ **Worker filtering** to focus on specific services
- ✅ **Log level filtering** (info, warn, error)
- ✅ **Full-text search** across log messages
- ✅ **Environment tags** (preview vs production)
- ✅ **Auto-refresh** (30-second intervals)
- ✅ **Expandable log entries** with full context

## Cost

**~$0-5/month** for typical usage:
- R2 storage: ~$0.02/month (compressed logs)
- R2 operations: ~$0.01/month (batched writes)
- Cloudflare Pages: Free

Compare to:
- Datadog: $15-30/month
- Logtail: $30-60/month
- Sentry: $50-100/month

## Architecture

```
Workers → Logpush → R2 → Pages Function → Dashboard UI
```

- **Cloudflare Logpush**: Automatically sends Worker logs to R2 (every 30s-5min, batched)
- **R2 Bucket**: Stores compressed logs (gzip NDJSON format)
- **Pages Function**: Reads, decompresses, and parses logs from R2
- **Dashboard UI**: Clean, searchable interface with filters

**No database. No complex API. No SDK integration required.**

## Quick Start

### 1. Create R2 Bucket

```bash
npx wrangler r2 bucket create worker-logs
```

### 2. Enable Logpush on Your Workers

```bash
npx wrangler logpush create \
  --destination="r2://worker-logs/logs" \
  --dataset="workers_trace_events" \
  --filter='ScriptName == "your-worker-name"' \
  --output-options="fields=EventTimestampMs,Outcome,ScriptName,ScriptTags,Logs,Exceptions,Request,Response"
```

### 3. Deploy Dashboard

```bash
cd dashboard
npm install
npm run build
npx wrangler pages deploy
```

### 4. Set Admin Password

```bash
cd dashboard
npx wrangler pages secret put ADMIN_PASSWORD
```

### 5. Access Your Logs

Visit your Pages URL and log in with:
- Username: `admin`
- Password: (what you just set)

**Full setup guide:** [SETUP.md](SETUP.md)

## Screenshots

### Log Viewer Interface
- Date picker to select logs by date
- Worker filter dropdown
- Log level filtering (info, warn, error)
- Search box for full-text search
- Auto-refresh toggle

### Log Entry Details
- Click any log to expand and see full context
- Request/response data included
- Stack traces for errors
- Timestamps and metadata

## How It Works

1. Your Worker runs and calls `console.log()`, `console.warn()`, `console.error()`
2. Cloudflare Logpush batches these logs every 30s-5min
3. Logs are compressed (gzip) and written to R2 as NDJSON files
4. Dashboard reads from R2, decompresses, parses, and displays
5. Logs organized by date: `logs/YYYY/MM/DD/HH/`

## Usage

### Viewing Logs

1. Select a date (defaults to today)
2. Optionally filter by worker name
3. Optionally filter by log level
4. Optionally search for specific text
5. Click any log entry to expand and see details

### Worker Code

No changes needed! Just use console methods normally:

```typescript
export default {
  async fetch(request, env) {
    console.log('Request received:', request.url);

    try {
      const result = await handleRequest(request);
      console.log('Request completed successfully');
      return result;
    } catch (error) {
      console.error('Request failed:', error.message);
      throw error;
    }
  }
}
```

All console output automatically appears in the log viewer.

### Environment Tagging

To see "preview" vs "production" badges, tag your Workers:

```toml
# wrangler.toml
[env.production]
tags = ["environment:production"]

[env.preview]
tags = ["environment:preview"]
```

## Project Structure

```
project-monitoring/
├── dashboard/
│   ├── app/
│   │   └── routes/
│   │       └── logs.tsx          # Log viewer UI
│   ├── functions/
│   │   └── api/
│   │       └── logs.ts            # Pages Function (R2 access)
│   └── wrangler.toml              # R2 binding + config
├── SETUP.md                       # Full setup guide
└── README.md                      # This file
```

## What's NOT Included

This is a **minimal log viewer**, not a full observability platform. It does NOT include:

- ❌ Error tracking with deduplication (just view raw errors)
- ❌ User feedback system (use GitHub Issues instead)
- ❌ Health check monitoring (use Cloudflare Analytics)
- ❌ Alerting (use Cloudflare email workers if needed)
- ❌ Real-time tailing (logs delayed 30s-5min by Logpush)
- ❌ Advanced querying (basic search only)

For those features, use:
- **Debugging**: `wrangler tail` (real-time)
- **Metrics**: Cloudflare Workers Analytics
- **Feedback**: GitHub Issues API
- **Alerting**: Cloudflare Email Workers

## Troubleshooting

### No logs appearing?

```bash
# Check Logpush is configured
npx wrangler logpush list

# Verify R2 has logs
npx wrangler r2 object list worker-logs --prefix logs/
```

### Logs are delayed?

Normal! Logpush batches every 30s-5min. Enable auto-refresh in the dashboard.

### Dashboard shows empty?

- Check you're viewing the correct date (UTC-based)
- Verify R2 bucket binding in `dashboard/wrangler.toml`
- Check authentication (username: `admin`)

**Full troubleshooting:** [SETUP.md#troubleshooting](SETUP.md#troubleshooting)

## Maintenance

### Log Retention

Set up R2 lifecycle rules to auto-delete old logs:

1. Cloudflare Dashboard → R2 → `worker-logs`
2. Settings → Lifecycle Rules
3. Add rule: Delete after 30 days with prefix `logs/`

### Cost Monitoring

Check R2 usage in Cloudflare Dashboard:
- R2 → `worker-logs` → View storage size and operations
- Typical: <1GB storage, <10k operations/month = ~$0.03/month

## Contributing

This is a personal tool for monitoring FollowThru and CarScout projects. Feel free to fork and adapt for your own use.

## License

MIT

---

**Simple. Cheap. Effective.**

No external dependencies. No complex integrations. Just Cloudflare-native logging.
