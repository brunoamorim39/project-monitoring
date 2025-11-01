# Project Monitoring - Setup Guide

Simple R2-based log viewer for Cloudflare Worker logs.

## Overview

This tool provides a clean, GitHub-style dark theme interface to view logs from your Cloudflare Workers. It uses Cloudflare's native Logpush feature to send logs to an R2 bucket, then displays them in a searchable dashboard.

**Cost:** ~$0-5/month (R2 storage + operations, mostly free tier)

---

## Step 1: Create R2 Bucket

First, create an R2 bucket to store your Worker logs:

```bash
npx wrangler r2 bucket create worker-logs
```

This creates a bucket named `worker-logs` that will receive all your Worker logs.

---

## Step 2: Enable Logpush on Your Workers

For each Worker you want to monitor, enable Logpush:

### Example: FollowThru Backend

```bash
npx wrangler logpush create \
  --destination="r2://worker-logs/logs" \
  --dataset="workers_trace_events" \
  --filter='ScriptName == "followthru-backend"' \
  --output-options="fields=EventTimestampMs,Outcome,ScriptName,ScriptTags,Logs,Exceptions,Request,Response"
```

### Example: CarScout API

```bash
npx wrangler logpush create \
  --destination="r2://worker-logs/logs" \
  --dataset="workers_trace_events" \
  --filter='ScriptName == "carscout-api"' \
  --output-options="fields=EventTimestampMs,Outcome,ScriptName,ScriptTags,Logs,Exceptions,Request,Response"
```

### Notes:
- Replace `"followthru-backend"` with your actual Worker name
- The `ScriptName` filter ensures only that specific Worker's logs are sent
- Logs are batched and sent every 30 seconds to 5 minutes
- Files are organized in R2 as: `logs/YYYY/MM/DD/HH/timestamp_random.log.gz`

### To Find Your Worker Names:

```bash
npx wrangler deployments list
```

---

## Step 3: Configure Dashboard

### Set Admin Password

The dashboard uses basic authentication. Set your admin password as a secret:

```bash
cd dashboard
npx wrangler pages secret put ADMIN_PASSWORD
# Enter your password when prompted
```

The username is `admin` (configured in `wrangler.toml`).

### Verify R2 Binding

Check that `dashboard/wrangler.toml` has the R2 bucket binding:

```toml
[[r2_buckets]]
binding = "LOGS_BUCKET"
bucket_name = "worker-logs"
preview_bucket_name = "worker-logs"
```

This should already be configured.

---

## Step 4: Deploy Dashboard

Build and deploy the dashboard to Cloudflare Pages:

```bash
cd dashboard
npm install
npm run build
npx wrangler pages deploy
```

### First-Time Setup

If this is your first deployment:

1. Follow the prompts to create a new Pages project
2. Name it `project-monitoring` (or whatever you prefer)
3. The deployment will give you a URL like: `https://project-monitoring-xxx.pages.dev`

### Subsequent Deployments

Just run `npx wrangler pages deploy` to update.

---

## Step 5: Access Your Logs

1. Visit your Pages URL: `https://project-monitoring-xxx.pages.dev`
2. Click "Logs" in the navigation
3. Log in with:
   - Username: `admin`
   - Password: (what you set in Step 3)

4. Use the filters:
   - **Date picker**: Select which date's logs to view
   - **Worker filter**: Filter by specific Worker name
   - **Level filter**: Filter by log level (info, warn, error)
   - **Search**: Search within log messages
   - **Auto-refresh**: Toggle 30-second auto-refresh

---

## How It Works

```
Your Workers
  │
  │ (console.log, errors, etc.)
  ├──> Cloudflare Logpush
  │         │
  │         │ (every 30s-5min, batched)
  │         │
  │         ├──> R2 Bucket (gzip NDJSON files)
  │                   │
  │                   │
  │                   ├──> Pages Function (decompress, parse, filter)
  │                            │
  │                            │
  │                            ├──> Dashboard UI (display, search)
```

**Log Flow:**
1. Your Worker runs and calls `console.log()` or throws errors
2. Cloudflare Logpush batches these logs
3. Every 30 seconds to 5 minutes, logs are compressed (gzip) and written to R2
4. When you visit the dashboard, it reads from R2, decompresses, and displays
5. Logs are organized by date: `logs/YYYY/MM/DD/`

---

## Tagging Workers by Environment

To see "preview" vs "production" tags in the log viewer, tag your Workers:

### Option 1: In wrangler.toml

```toml
# Production worker
[env.production]
workers_dev = false
tags = ["environment:production"]

# Preview worker
[env.preview]
workers_dev = true
tags = ["environment:preview"]
```

### Option 2: Via CLI

```bash
# Tag production worker
npx wrangler deploy --env production --tag environment:production

# Tag preview worker
npx wrangler deploy --env preview --tag environment:preview
```

Tags will appear as badges in the log viewer.

---

## Usage Tips

### Viewing Recent Logs

The date picker defaults to today. Logs appear 30s-5min after they're generated (Logpush batch delay).

### Searching Logs

Use the search box to filter by message content. Search is case-insensitive and searches across all loaded logs.

### Worker Console Output

All `console.log()`, `console.warn()`, `console.error()` calls in your Worker appear as separate log entries.

Example Worker code:
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

All three console calls will appear as separate entries in the log viewer.

### Understanding Log Levels

The viewer maps Cloudflare's log levels:
- `console.log()` → **INFO** (blue)
- `console.warn()` → **WARN** (orange)
- `console.error()` → **ERROR** (red)
- Uncaught exceptions → **ERROR** (red, with stack trace)

---

## Troubleshooting

### No logs appearing?

1. **Check Logpush is configured:**
   ```bash
   npx wrangler logpush list
   ```
   You should see your configured Logpush jobs.

2. **Verify R2 bucket has logs:**
   ```bash
   npx wrangler r2 object list worker-logs --prefix logs/
   ```
   You should see `.log.gz` files.

3. **Check Worker name filter:**
   Make sure the `ScriptName` in your Logpush filter matches your actual Worker name.

4. **Wait for batch:**
   Logs are batched every 30s-5min. Wait a few minutes after triggering activity.

### Dashboard shows empty logs?

1. **Check date:**
   Make sure you're viewing the correct date. Logs are UTC-based.

2. **Check authentication:**
   Ensure you're logged in (username: `admin`, password: what you set).

3. **Check R2 binding:**
   Verify `wrangler.toml` has the correct R2 bucket binding.

### Logs are old/stale?

Logs may take 30s-5min to appear due to Logpush batching. This is normal. Enable auto-refresh to check for new logs every 30 seconds.

---

## Cost Estimates

### R2 Storage
- **$0.015/GB/month**
- Compressed logs are ~1-5MB per 1000 requests
- Example: 100k requests/day = ~3-15MB/day = ~90-450MB/month = **~$0.02/month**

### R2 Operations
- **Class A (write):** $4.50/million operations
- **Class B (read):** $0.36/million operations
- Logpush writes: ~2,000 per day (batching) = **~$0.01/month**
- Dashboard reads: ~100 per day = **~$0.00/month**

### Cloudflare Pages
- **Free** (included in free tier)
- Pages Functions: 100k requests/day free

### Total Estimated Cost
**~$0.03-0.50/month** for typical usage (1-10M requests/month)

Compare to external tools:
- Datadog: $15-30/month minimum
- Logtail: $30-60/month
- Sentry: $50-100/month

---

## Maintenance

### Log Retention

Logs are kept indefinitely in R2 by default. To save costs, you can set up a lifecycle policy:

```bash
# Delete logs older than 30 days (example)
# This reduces storage costs for old logs
```

You can configure this in the Cloudflare dashboard:
1. Go to R2 → `worker-logs` bucket
2. Settings → Lifecycle Rules
3. Add rule: Delete objects after 30 days with prefix `logs/`

### Monitoring Costs

Check your R2 usage:
1. Cloudflare Dashboard → R2
2. Click `worker-logs`
3. View storage size and operations

Typical usage: <1GB storage, <10k operations/month = ~$0.03/month

---

## Next Steps

Once you have logs flowing:

1. **Monitor errors:** Filter by level "error" to see exceptions
2. **Track patterns:** Use search to find specific error messages
3. **Compare environments:** Filter by environment tag to compare preview vs production
4. **Debug issues:** Use the date picker to view logs from when an issue occurred

For feature requests or feedback, use GitHub Issues in your FollowThru project.

---

## Uninstalling

To remove the monitoring platform:

1. **Delete Logpush jobs:**
   ```bash
   npx wrangler logpush list
   npx wrangler logpush delete <job-id>
   ```

2. **Delete R2 bucket:**
   ```bash
   npx wrangler r2 bucket delete worker-logs
   ```

3. **Delete Pages deployment:**
   ```bash
   npx wrangler pages project delete project-monitoring
   ```

---

**That's it!** You now have a simple, cost-effective log viewer for your Cloudflare Workers.
