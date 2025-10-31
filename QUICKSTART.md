# Quick Start Guide

Get your monitoring platform up and running in 5 minutes!

## Prerequisites

- Node.js 18+
- Cloudflare account
- `yarn install -g wrangler` (Cloudflare CLI)

## Using Makefile (Super Fast ⚡)

```bash
# 1. Clone and setup (1 minute)
git clone <your-repo>
cd project-monitoring
make setup

# 2. Login to Cloudflare
make cf-login

# 3. Create resources (1 minute)
make cf-create-all
# Copy IDs to workers/api/wrangler.toml

# 4. Run migrations (30 seconds)
make db-migrate

# 5. Set secrets (30 seconds)
make cf-secrets

# 6. Start developing! (instant)
make dev
```

That's it! Open http://localhost:5173 to access the dashboard.

## Manual Setup (Without Makefile)

## 1. Install & Setup (2 minutes)

```bash
# Clone and install
git clone <your-repo>
cd project-monitoring
yarn install

# Login to Cloudflare
wrangler login
```

## 2. Create Resources (1 minute)

```bash
cd workers/api

# Create database
wrangler d1 create project-monitoring
# Copy the database_id and update workers/api/wrangler.toml

# Create KV namespace
wrangler kv:namespace create project-monitoring-rate-limit-kv
# Copy the id and update workers/api/wrangler.toml

# Run migrations
wrangler d1 execute project-monitoring --file=./drizzle/migrations/0000_initial.sql
```

## 3. Configure Secrets (30 seconds)

```bash
# Set admin credentials
wrangler secret put ADMIN_USERNAME
# Enter: admin

wrangler secret put ADMIN_PASSWORD
# Enter: your-secure-password

# Create local config
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your credentials
```

## 4. Deploy (1 minute)

```bash
cd ../..  # Back to root

# Deploy API
make deploy-api
# Note the Worker URL

# Update dashboard config
# Edit dashboard/wrangler.toml and dashboard/app/lib/api.ts with Worker URL

# Deploy dashboard
make deploy-dashboard
# Note the Pages URL
```

## 5. Create First Project (30 seconds)

1. Open your dashboard URL
2. Go to "Projects" → "New Project"
3. Name: "Test Project", Slug: "test-project"
4. Save the API key!

## 6. Test It!

```bash
# Test with curl
curl -X POST https://your-worker-url.workers.dev/api/v1/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "logs": [{
      "level": "info",
      "message": "Hello from monitoring platform!"
    }]
  }'

# Check the dashboard - you should see the log!
```

## Next Steps

- Add the widget to your website ([README.md](README.md#1-embeddable-feedback-widget))
- Integrate logs into your apps ([README.md](README.md#2-submit-logs))
- Set up error tracking ([README.md](README.md#3-report-errors))
- Configure health checks ([README.md](README.md#4-health-checks))

## Local Development

```bash
# Terminal 1: API
make dev-api

# Terminal 2: Dashboard
make dev-dashboard

# Open http://localhost:5173
```

## Need Help?

- Full setup guide: [SETUP.md](SETUP.md)
- Complete documentation: [README.md](README.md)
- Open an issue on GitHub

---

**That's it!** You now have a fully functional monitoring platform running on Cloudflare's edge network. 🚀
