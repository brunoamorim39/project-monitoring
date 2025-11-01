# Worker Log Viewer - Claude Development Guide

Simple R2-based log viewer for Cloudflare Workers. This guide provides context for working on this codebase.

**ANCHORING BIAS REMINDER**
Claude has a bias toward agreement. If you ask "is this good?" about something clearly bad, Claude might agree to be agreeable. Instead, ask Claude to give their genuine first take on what they see. This produces better results.

---

## Project Overview

**Purpose:**
A minimal dashboard to view logs from Cloudflare Workers. Uses Cloudflare's native Logpush feature to automatically send logs to R2 storage, then provides a clean GitHub-style interface to browse and search them.

**Not a SaaS. Not complex monitoring. Just a simple log viewer.**

**Key Features:**
- Auto-collection via Cloudflare Logpush (no SDK needed)
- Date picker to browse historical logs
- Filter by worker, log level, environment
- Full-text search
- GitHub dark theme UI
- ~$0-5/month cost

---

## Tech Stack

**Frontend:**
- Remix 2.17 (SSR framework on Cloudflare Pages)
- React 19
- Tailwind CSS
- Vite

**Backend:**
- Cloudflare Pages Functions (serverless, auto-deployed with dashboard)
- R2 bucket (log storage)
- NO database, NO Worker API, NO complex backend

**Infrastructure:**
- Cloudflare Logpush (automatic log collection from Workers)
- Cloudflare Pages (dashboard hosting)
- Cloudflare R2 (log storage - gzip NDJSON files)
- Basic HTTP Auth (admin access only)

---

## Project Structure

```
project-monitoring/
├── app/                          # Remix application
│   ├── components/               # React components
│   │   └── Layout.tsx           # Dashboard layout
│   ├── lib/                     # Client utilities
│   ├── routes/                  # Remix routes
│   │   ├── _index.tsx          # Home page
│   │   └── logs.tsx            # Log viewer (main feature)
│   ├── utils/                   # Utilities
│   │   └── env.server.ts       # Environment helpers
│   ├── entry.client.tsx        # Client entry
│   ├── entry.server.tsx        # Server entry
│   ├── root.tsx                # Root component
│   └── tailwind.css            # Global styles
├── functions/                   # Cloudflare Pages Functions
│   └── api/
│       └── logs.ts             # R2 log reader (decompresses, parses, filters)
├── public/                      # Static assets
├── build/                       # Build output (git ignored)
├── .dev.vars                    # Local environment variables
├── wrangler.toml               # Pages deployment config
├── package.json                 # Single package (no workspaces)
├── tsconfig.json               # TypeScript config
├── vite.config.ts              # Vite config
├── remix.config.js             # Remix config
├── tailwind.config.js          # Tailwind config
├── Makefile                    # Simple dev commands
├── README.md                   # Project overview
├── SETUP.md                    # Setup guide
└── CLAUDE.md                   # This file
```

---

## How It Works

```
Worker (console.log) → Logpush → R2 (gzip NDJSON) → Pages Function → Dashboard UI
```

1. Your Worker runs normally, calls `console.log()`, `console.warn()`, `console.error()`
2. Cloudflare Logpush batches logs every 30s-5min
3. Logs compressed (gzip) and written to R2 as NDJSON files
4. Dashboard Pages Function reads R2, decompresses, parses, filters
5. UI displays logs with search, filters, expandable entries

**No database. No API to maintain. Just read from R2.**

---

## Development Commands

### Quick Start

```bash
make install    # Install dependencies
make dev        # Start development server (http://localhost:5173)
```

### Build & Deploy

```bash
make build      # Build for production
make deploy     # Deploy to Cloudflare Pages (asks for confirmation)
make preview    # Preview production build locally
```

### Quality

```bash
make typecheck  # Run TypeScript type checking
make check      # Alias for typecheck
```

### Cleanup

```bash
make clean      # Remove build artifacts
make clean-all  # Remove build artifacts + node_modules
```

---

## 🚨 CRITICAL: DEVELOPMENT PHILOSOPHY - NO HALF-MEASURES 🚨

**Quality Over Speed:**
- Fix ALL known related issues while the context is fresh
- Suggest thorough solutions by default
- Technical debt compounds exponentially - prevent it rather than manage it
- Only defer work that requires user feedback or external dependencies

**When You Find Related Issues:**
- Don't just fix the immediate problem
- Look for similar patterns that might have the same issue
- Suggest comprehensive fixes that address the root cause
- Example: If fixing a regex pattern error, check all other patterns in the file

**What This Means:**
- ❌ "I fixed the specific line you mentioned"
- ✅ "I fixed the issue and found 3 similar patterns that had the same problem"

---

## 🚨 CRITICAL: QUALITY CONTROL - VERIFY BEFORE COMPLETING 🚨

**Before Marking Any Work as Complete:**

**For Code Changes:**
- [ ] Run `make typecheck` to verify TypeScript types
- [ ] Test in browser if UI changes (USER ONLY for running dev servers)
- [ ] No console errors or warnings
- [ ] All related functionality still works

**For UI Changes:**
- [ ] Matches GitHub dark theme colors EXACTLY
- [ ] All clickable elements have cursor pointer (hover states)
- [ ] Responsive on mobile, tablet, desktop
- [ ] No layout shifts or visual bugs

**Rule:** Only mark work as completed when ALL verification steps pass. If blocked, create a todo for the user to complete.

---

## 🚨 CRITICAL: UI STYLING - GITHUB DARK THEME 🚨

**Log Viewer Theme (Do NOT change these colors):**
- Background: `#0d1117`
- Cards: `#161b22`
- Text: `#c9d1d9`
- Borders: `#30363d`
- Accent/Links: `#58a6ff`
- Muted text: `#6e7681`

**Log Level Colors:**
- Info: `#58a6ff` (blue)
- Warn: `#d29922` (orange)
- Error: `#f85149` (red)
- Critical: `#da3633` (dark red)

**Fonts:**
- UI text: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`
- Log content: `'Consolas', 'Monaco', monospace`

---

## Key Files

### Log Viewer UI ([app/routes/logs.tsx](app/routes/logs.tsx))

The main feature. Shows logs with:
- Date picker (selects which date's logs to load)
- Worker filter dropdown
- Log level filter (info, warn, error)
- Search box (full-text search)
- Auto-refresh toggle (30s intervals)
- Expandable log entries (click to see context/metadata)
- GitHub dark theme styling

**Loader:**
- Calls Pages Function `/api/logs`
- Passes filters (date, worker, level, search)
- Returns parsed logs from R2

**UI Pattern:**
- Card-based expandable entries
- Monospace fonts for logs
- Color-coded log levels
- Environment and worker badges

### Pages Function ([functions/api/logs.ts](functions/api/logs.ts))

Server-side R2 access:
- Lists R2 objects for selected date
- Reads and decompresses .gz files
- Parses NDJSON (Cloudflare's log format)
- Extracts `console.log` entries and exceptions
- Filters by worker name, log level, search query
- Returns JSON to dashboard

**Cloudflare Log Format:**
```json
{
  "EventTimestampMs": 1234567890,
  "Outcome": "ok",
  "ScriptName": "my-worker",
  "ScriptTags": ["environment:production"],
  "Logs": [
    {"Level": "log", "Message": ["Hello", "world"], "TimestampMs": 1234567890}
  ],
  "Exceptions": [],
  "Request": {"URL": "...", "Method": "GET"},
  "Response": {"Status": 200}
}
```

### Configuration ([wrangler.toml](wrangler.toml))

Cloudflare Pages deployment config:
- R2 bucket binding: `LOGS_BUCKET → worker-logs`
- Admin username variable (password set as secret)
- Build output directory: `./build/client`
- Node.js compat flag

---

## Environment Variables

### Local Development (.dev.vars)

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password-here
```

### Production (Cloudflare Secrets)

```bash
npx wrangler pages secret put ADMIN_PASSWORD
```

---

## Architecture Decisions

**Why R2 instead of Database?**
- Cloudflare Logpush writes to R2 automatically
- No schema migrations, no database maintenance
- Logs are already in R2 - why duplicate to D1?
- R2 is cheaper for log storage (~$0.015/GB vs D1 limits)

**Why No Worker API?**
- Pages Functions can access R2 directly
- No need for separate API deployment
- Simpler: one deployment instead of two

**Why No Client SDK?**
- Workers just use `console.log()` normally
- Logpush is automatic, no integration needed
- Keeps Worker code simple and native

**Why Basic Auth?**
- Internal tool, single admin access
- Simple and secure enough
- No user management complexity

**Why No Error Deduplication/Feedback/Health Checks?**
- Out of scope for "simple log viewer"
- Use GitHub Issues for feedback instead
- Use Cloudflare Analytics for metrics
- Use `wrangler tail` for real-time debugging

---

## Common Tasks

### Adding a New Filter

1. Add URL param handling in `logs.tsx` loader
2. Pass param to Pages Function
3. Add filter logic in `functions/api/logs.ts`
4. Add UI control in `logs.tsx` component

### Changing Log Display

1. Update `logs.tsx` component
2. Modify card styles (inline `<style>` tag)
3. Keep GitHub dark theme colors (see section above)

### Updating Logpush Format

If Cloudflare changes log format:
1. Update `CloudflareLogEvent` interface in `functions/api/logs.ts`
2. Update `extractLogs()` parsing logic
3. Test with real logs

---

## Testing

**Local Testing:**
```bash
make dev  # Start dev server
```
Visit http://localhost:5173/logs

**Testing with Real Logs:**
1. Enable Logpush on a test Worker (see SETUP.md)
2. Trigger some activity (make requests)
3. Wait 30s-5min for batch
4. Check R2 bucket has logs: `npx wrangler r2 object list worker-logs`
5. View in dashboard

**No Unit Tests:**
- This is a simple UI tool
- Manual testing is sufficient
- TypeScript catches most bugs

---

## Deployment

```bash
make deploy
```

This:
1. Builds the Remix app (`yarn build`)
2. Deploys to Cloudflare Pages (`wrangler pages deploy`)
3. Asks for confirmation before deploying

**First Deployment:**
- Creates new Pages project
- Follow prompts to name it
- Note the URL: `https://project-monitoring-xxx.pages.dev`

**Subsequent Deployments:**
- Just updates existing project
- Deployment is automatic

---

## Troubleshooting

**Logs not appearing?**
1. Check Logpush is configured: `npx wrangler logpush list`
2. Verify R2 has logs: `npx wrangler r2 object list worker-logs --prefix logs/`
3. Check Worker name in Logpush filter matches actual Worker name
4. Wait for batch (30s-5min delay)

**Dashboard shows 404?**
- Ensure R2 bucket binding is correct in `wrangler.toml`
- Check ADMIN_PASSWORD is set

**TypeScript errors?**
```bash
make typecheck
```

**Build fails?**
```bash
make clean
make install
make build
```

---

## What This Is NOT

❌ Full observability platform (use Datadog/New Relic for that)
❌ Real-time log tailing (use `wrangler tail` for that)
❌ Error tracking with deduplication (use Sentry for that)
❌ User feedback system (use GitHub Issues for that)
❌ Alerting system (use Cloudflare Email Workers for that)

✅ Simple log viewer for occasional debugging
✅ Historical log browser
✅ Basic search and filtering
✅ Cost-effective (~$0.03/month)

---

## Maintenance

**Log Retention:**
Set up R2 lifecycle rules to auto-delete old logs:
1. Cloudflare Dashboard → R2 → `worker-logs`
2. Settings → Lifecycle Rules
3. Add rule: Delete after 30 days with prefix `logs/`

**Cost Monitoring:**
Check R2 usage monthly:
- R2 → `worker-logs` → View storage
- Typical: <1GB = ~$0.02/month

**Updates:**
- Keep dependencies up to date: `yarn upgrade-interactive`
- Test after Cloudflare platform updates
- Monitor for Logpush format changes

---

## Getting Help

**Documentation:**
- [README.md](README.md) - Project overview and features
- [SETUP.md](SETUP.md) - Setup guide with Logpush commands
- This file (CLAUDE.md) - Development context

**Issues:**
- Check existing logs in dashboard first
- Use `wrangler tail` for real-time debugging
- Review Cloudflare Logpush docs if issues with log collection

---

**Last Updated:** 2025-11-01
**Maintained By:** Claude Code Assistant

**Remember:** This is a simple tool. Keep it simple.
