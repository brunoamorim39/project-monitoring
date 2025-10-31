# Setup Guide

Follow these steps to set up and deploy your Project Monitoring Platform.

## Prerequisites

- Node.js 18 or higher
- Yarn (v1.22+)
- A Cloudflare account (free tier works)
- Wrangler CLI installed globally

```bash
yarn install -g wrangler
```

## Step-by-Step Setup

### 1. Install Dependencies

```bash
yarn install
```

This will install dependencies for all workspaces.

### 2. Login to Cloudflare

```bash
wrangler login
```

Follow the browser prompts to authenticate.

### 3. Create D1 Database

```bash
cd workers/api
wrangler d1 create project-monitoring
```

Copy the output that looks like:

```
[[d1_databases]]
binding = "DB"
database_name = "project-monitoring"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Update `workers/api/wrangler.toml` with your database ID.

### 4. Create KV Namespace

```bash
wrangler kv:namespace create project-monitoring-rate-limit-kv
```

Copy the namespace ID and update `workers/api/wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-kv-id-here"
```

### 5. Run Database Migrations

```bash
cd workers/api
wrangler d1 execute project-monitoring --file=./drizzle/migrations/0000_initial.sql
```

You should see "Success" message.

### 6. Set Production Secrets

```bash
# From workers/api directory
wrangler secret put ADMIN_USERNAME
# Enter: admin (or your preferred username)

wrangler secret put ADMIN_PASSWORD
# Enter: your-secure-password (choose a strong password)
```

### 7. Set Local Development Environment

```bash
# From workers/api directory
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and set your local admin credentials:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-local-password
```

### 8. Test Locally

Start the API Worker:

```bash
# From root directory
make dev-api
```

In another terminal, start the dashboard:

```bash
make dev-dashboard
```

Open http://localhost:5173 in your browser.

### 9. Deploy to Production

Deploy the API Worker:

```bash
make deploy-api
```

Note the Worker URL (e.g., `https://project-monitoring.your-subdomain.workers.dev`)

Update `dashboard/wrangler.toml` with your Worker URL:

```toml
[vars]
API_URL = "https://project-monitoring.your-subdomain.workers.dev"
```

Also update `dashboard/app/lib/api.ts` line 3 with your Worker URL.

Deploy the dashboard:

```bash
make deploy-dashboard
```

Note the Pages URL (e.g., `https://project-monitoring.pages.dev`)

### 10. Build and Host Widget

```bash
cd widget
make build-widget
```

The built widget will be in `widget/build/widget.js`.

**Option A: Host on Cloudflare Pages**

Create a new Pages project and upload the `widget/build` directory.

**Option B: Include in Dashboard Assets**

Copy `widget.js` to `dashboard/public/widget.js` and it will be served from your dashboard URL.

### 11. Create Your First Project

1. Open your dashboard URL
2. Navigate to "Projects"
3. Click "New Project"
4. Enter name: "My First Project"
5. Enter slug: "my-first-project"
6. Click "Create Project"
7. Copy and save the API key shown

### 12. Test Integration

Add the widget to any HTML page:

```html
<script src="https://your-dashboard-url.pages.dev/widget.js"></script>
<script>
  MonitorWidget.init({
    apiKey: 'your_project_api_key',
    apiUrl: 'https://your-worker-url.workers.dev',
  });
</script>
```

Or test with curl:

```bash
curl -X POST https://your-worker-url.workers.dev/api/v1/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_project_api_key" \
  -d '{
    "logs": [{
      "level": "info",
      "message": "Test log from setup"
    }]
  }'
```

## Verification Checklist

- [ ] D1 database created and ID updated in wrangler.toml
- [ ] KV namespace created and ID updated in wrangler.toml
- [ ] Database migrations ran successfully
- [ ] Admin credentials set via `wrangler secret put`
- [ ] Local .dev.vars file created for development
- [ ] API Worker deployed and URL noted
- [ ] Dashboard wrangler.toml updated with Worker URL
- [ ] Dashboard app/lib/api.ts updated with Worker URL
- [ ] Dashboard deployed and URL noted
- [ ] Widget built successfully
- [ ] First project created in dashboard
- [ ] API key saved securely
- [ ] Test request successful

## Troubleshooting

### "No such D1 database"

Make sure you ran the database creation command and updated the database ID in `wrangler.toml`.

### "KV namespace not found"

Create the KV namespace with `wrangler kv:namespace create RATE_LIMIT_KV` and update the ID in `wrangler.toml`.

### "Unauthorized" when accessing dashboard

Check that you set the admin credentials with `wrangler secret put` and that you're using the correct username/password.

### Migration fails

If the migration fails, you may need to drop the database and start over:

```bash
wrangler d1 execute project-monitoring --command="DROP TABLE IF EXISTS projects; DROP TABLE IF EXISTS feedback; DROP TABLE IF EXISTS logs; DROP TABLE IF EXISTS errors; DROP TABLE IF EXISTS health_checks; DROP TABLE IF EXISTS notes;"
```

Then run the migration again.

### Widget not loading

Check the browser console for errors. Common issues:
- Wrong API URL
- CORS not configured properly
- Invalid API key

## Next Steps

- Read the [README.md](README.md) for usage examples
- Explore the dashboard features
- Integrate monitoring into your projects
- Set up health check crons for your services

## Need Help?

Open an issue on GitHub with:
- Description of the problem
- Steps you've taken
- Error messages (if any)
- Your environment (Node version, OS, etc.)
