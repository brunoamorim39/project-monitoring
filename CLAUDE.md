# Project Monitoring Platform - Claude Development Guide

This guide provides comprehensive context and guidelines for working on the project-monitoring codebase. It follows patterns established in the FollowThru project.

**ANCHORING BIAS REMINDER**
Claude has a bias toward agreement. If you ask "is this good?" about something clearly bad, Claude might agree to be agreeable. Instead, ask Claude to give their genuine first take on what they see. This produces better results.

---

## 🚨 CRITICAL: UNDERSTAND THE DATABASE WORKFLOW 🚨

This project uses **FollowThru's database patterns**. You MUST understand this before making any database changes:

**Key Facts:**
- ✅ Drizzle config is in **ROOT** directory (`drizzle.config.ts`), NOT in `workers/api/`
- ✅ Uses `d1-http` driver for remote D1 database access
- ✅ Uses drizzle-kit 0.31+ (newer version with `migrate` command)
- ✅ Environment variables in ROOT `.dev.vars` file
- ✅ Migration workflow: `make db-update` = `make db-generate` + `make db-migrate`

**Before Making Any Schema Changes:**
- [ ] Read the root `drizzle.config.ts` to understand configuration
- [ ] Understand schema location: `workers/api/src/lib/schema.ts`
- [ ] Know migration output directory: `workers/api/drizzle/`
- [ ] Verify Cloudflare credentials are in root `.dev.vars`

**Migration Workflow:**
```bash
# Quick workflow (recommended for development)
make db-update  # Generates migration + applies to remote D1

# Step-by-step (for reviewing before applying)
make db-generate  # Generate migration from schema changes
# Review the generated SQL in workers/api/drizzle/
make db-migrate   # Apply to remote D1 database
```

**NEVER:**
- ❌ Use `make db-push` (has known bugs with duplicate indices)
- ❌ Expect a local SQLite database (this uses remote D1 only)
- ❌ Run database commands yourself (USER ONLY - see below)

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

**For Database Changes:**
- [ ] Schema changes are in `workers/api/src/lib/schema.ts`
- [ ] Migration has been generated (USER runs `make db-update`)
- [ ] Validation schemas updated in `packages/shared/src/schemas.ts`
- [ ] API routes updated to handle new fields
- [ ] Database query functions updated in `workers/api/src/lib/db.ts`

**For Code Changes:**
- [ ] Run `make check` to verify TypeScript types
- [ ] Test in browser if UI changes (USER ONLY for running dev servers)
- [ ] No console errors or warnings
- [ ] All related functionality still works

**For UI Changes:**
- [ ] Matches requested design EXACTLY if copying from FollowThru
- [ ] All clickable elements have cursor pointer (hover states)
- [ ] Responsive on mobile, tablet, desktop
- [ ] No layout shifts or visual bugs

**Rule:** Only mark work as completed when ALL verification steps pass. If blocked, create a todo for the user to complete.

---

## 🚨 CRITICAL: UI STYLING - COPY EXACTLY FROM FOLLOWTHRU 🚨

**When Told to Copy UI from FollowThru:**
- ✅ Copy colors EXACTLY - hex codes, opacity, everything
- ✅ Copy fonts EXACTLY - family, size, weight, monospace
- ✅ Copy spacing EXACTLY - padding, margins, gaps
- ✅ Copy layout EXACTLY - flex, grid, positioning
- ✅ Copy borders, shadows, border-radius EXACTLY
- ✅ Copy hover states, transitions EXACTLY

**Example - Log Viewer Dark Theme:**
```css
/* ✅ CORRECT - Exact FollowThru colors */
background: #0d1117;
card-background: #161b22;
text-color: #c9d1d9;
border-color: #30363d;
accent-color: #58a6ff;

/* ❌ WRONG - "Similar" colors */
background: #0a0a0a;
card-background: #1a1a1a;
text-color: #cccccc;
```

**Don't Take Creative Liberties:**
- ❌ Adding animations when asked to "style" something
- ❌ Changing color schemes to "improve" them
- ❌ Redesigning layouts when asked to fix specific issues
- ❌ Adding features beyond what was requested

**Do Ask First:**
- ✅ "Should I use the same dark theme as FollowThru's log viewer?"
- ✅ "Should this match the styling from [specific FollowThru component]?"
- ✅ "I notice this could benefit from [X] - should I add it?"

---

## Project Overview

**Purpose:**
Project Monitoring is a centralized monitoring platform for tracking logs, errors, feedback, and health checks for the FollowThru and CarScout projects. This is NOT a SaaS product - it's an internal tool for monitoring our specific projects.

**Key Features:**
- Log aggregation with environment filtering (preview/production)
- Error tracking and reporting
- User feedback collection
- Health check monitoring
- Search and filtering across all data types

**Why This Exists:**
- Monitor production and preview deployments separately
- Aggregate logs from multiple Cloudflare Workers
- Track errors across environments
- Collect user feedback in one place

---

## Tech Stack

**Frontend:**
- Remix 2.17 (SSR framework on Cloudflare Pages)
- React 19
- Tailwind CSS
- Vite

**Backend:**
- Cloudflare Workers (serverless API)
- Hono 3.12 (web framework)
- D1 Database (SQLite-compatible, remote only)
- Drizzle ORM 0.44.5 (database toolkit)
- drizzle-kit 0.31.4 (migrations)

**Infrastructure:**
- Cloudflare Pages (dashboard hosting)
- Cloudflare Workers (API hosting)
- Cloudflare D1 (database)
- Basic HTTP Auth (admin dashboard access)

---

## Project Structure

```
project-monitoring/
├── workers/api/              # Cloudflare Worker API
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   │   ├── projects.ts  # Project CRUD
│   │   │   ├── logs.ts      # Log submission/querying
│   │   │   ├── errors.ts    # Error tracking
│   │   │   ├── feedback.ts  # User feedback
│   │   │   ├── health.ts    # Health checks
│   │   │   └── stats.ts     # Dashboard statistics
│   │   ├── lib/
│   │   │   ├── schema.ts    # Drizzle database schema
│   │   │   ├── db.ts        # Database query functions
│   │   │   └── auth.ts      # Basic auth middleware
│   │   └── index.ts         # Worker entry point
│   ├── drizzle/             # Generated migrations (output)
│   │   └── migrations/      # SQL migration files
│   ├── wrangler.toml        # Worker configuration
│   └── package.json
├── dashboard/               # Remix admin dashboard
│   └── app/
│       ├── routes/          # Dashboard pages
│       │   ├── _index.tsx   # Dashboard home
│       │   ├── projects.tsx # Project management
│       │   ├── logs.tsx     # Log viewer (dark theme)
│       │   ├── errors.tsx   # Error viewer
│       │   ├── feedback.tsx # Feedback viewer
│       │   └── health.tsx   # Health checks
│       ├── components/      # React components
│       │   └── Layout.tsx   # Dashboard layout
│       ├── lib/             # Client utilities
│       │   └── api.ts       # API client
│       └── utils/
│           └── env.server.ts # Environment helpers
├── packages/shared/         # Shared TypeScript types
│   └── src/
│       └── schemas.ts       # Zod validation schemas
├── scripts/                 # Helper scripts
│   ├── run-drizzle.js      # Drizzle CLI wrapper
│   └── run-studio.js       # Drizzle Studio launcher
├── drizzle.config.ts        # Root Drizzle config (d1-http)
├── .dev.vars                # Root environment variables
├── .dev.vars.example        # Template for environment variables
├── Makefile                 # Development commands
├── package.json             # Root workspace config
└── CLAUDE.md               # This file
```

---

## Development Commands

### ⚠️ USER ONLY - DO NOT RUN THESE COMMANDS ⚠️

**Development Servers:**
```bash
make dev              # Start API + Dashboard concurrently
make dev-api          # Start API Worker only (localhost:8787)
make dev-dashboard    # Start Dashboard only (localhost:5173)
```

**Database Operations:**
```bash
make db-generate      # Generate migration from schema changes
make db-migrate       # Apply migrations to remote D1
make db-update        # Generate + migrate (recommended workflow)
make db-studio        # Open Drizzle Studio (visual DB browser)
```

**Setup:**
```bash
make setup            # Initial project setup
make install          # Install all dependencies
make env              # Create .dev.vars from example
make cf-create-all    # Create Cloudflare resources (D1, KV)
```

**Deployment:**
```bash
make deploy-api       # Deploy API Worker to production
make deploy-dashboard # Deploy Dashboard to Cloudflare Pages
```

### ✅ Claude Can Use (Read-Only)

**Type Checking & Linting:**
```bash
make check            # Run TypeScript type checking
```

**Build:**
```bash
make build            # Build all packages for production
```

**Information:**
```bash
make cf-ids           # Show Cloudflare resource IDs
make info             # Show project information
```

---

## Architecture Overview

### API Routes

All API routes are in `workers/api/src/routes/` and use Hono framework:

**Projects** (`/api/projects`):
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project by ID
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

**Logs** (`/api/logs`):
- `POST /api/logs` - Submit log entries (batch)
- `GET /api/logs` - Query logs with filters

**Errors** (`/api/errors`):
- `POST /api/errors` - Submit error
- `GET /api/errors` - Query errors with filters

**Feedback** (`/api/feedback`):
- `POST /api/feedback` - Submit user feedback
- `GET /api/feedback` - Query feedback with filters

**Health Checks** (`/api/health`):
- `POST /api/health` - Submit health check
- `GET /api/health` - Query health checks

**Stats** (`/api/stats`):
- `GET /api/stats` - Dashboard statistics (log count, error count, etc.)

### Database Schema

**Key Tables** (in `workers/api/src/lib/schema.ts`):

```typescript
// Projects being monitored
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  createdAt: integer('created_at').notNull(),
});

// Application logs
export const logs = sqliteTable('logs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  environment: text('environment').notNull().default('production'), // 'preview' | 'production'
  level: text('level').notNull(), // 'info' | 'warn' | 'error' | 'critical'
  message: text('message').notNull(),
  context: text('context'), // JSON string
  timestamp: integer('timestamp').notNull(),
});

// Similar structure for errors, feedback, healthChecks tables...
```

**Environment Support:**
- All monitoring tables have `environment` field
- Values: `'preview'` | `'production'`
- Environments are global (not per-project)
- Filtering by environment in all queries

### Authentication

- Basic HTTP Auth for admin dashboard
- Username/password from environment variables
- No user accounts - single admin access
- Credentials: `ADMIN_USERNAME` and `ADMIN_PASSWORD`

---

## Environment Variables

### Root `.dev.vars` (for migrations/studio)

```bash
# Cloudflare Infrastructure (for Drizzle Studio / migrations)
# Get from: https://dash.cloudflare.com/profile/api-tokens
# Required for: db:migrate, db:studio commands
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_DATABASE_ID=
CLOUDFLARE_API_TOKEN=

# Admin Credentials (for dashboard authentication)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

### `workers/api/.dev.vars` (for local API development)

```bash
# Admin Credentials (same as root .dev.vars)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

**Getting Cloudflare Credentials:**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create API token with "D1:Edit" permissions
3. Get Account ID from Workers & Pages dashboard
4. Get Database ID from D1 dashboard

---

## Key Implementation Notes

### Database Patterns

**Drizzle ORM with D1:**
- Remote D1 database access only (no local SQLite)
- `d1-http` driver for HTTP-based database operations
- Schema: `workers/api/src/lib/schema.ts`
- Migrations: `workers/api/drizzle/migrations/`
- Configuration: `drizzle.config.ts` (root directory)

**Migration Best Practices:**
- ✅ ALWAYS use migrations (generate → migrate workflow)
- ✅ Review generated SQL before applying
- ✅ Commit migration files to git
- ❌ NEVER use `db:push` (has known bugs with duplicate indices)
- ❌ NEVER manually edit the database

**Query Patterns:**
```typescript
// ✅ CORRECT - Use repository functions
const logs = await getLogs(db, {
  projectId: 'my-project',
  environment: 'production',
  level: 'error',
  search: 'timeout',
  limit: 50,
  offset: 0,
});

// ❌ WRONG - Direct Drizzle queries in routes
const logs = await db.query.logs.findMany({
  where: eq(logs.projectId, 'my-project'),
});
```

### Authentication Flow

1. Dashboard makes API request with Basic Auth header
2. API middleware validates credentials against env vars
3. If valid, request proceeds; if invalid, returns 401
4. No sessions, no tokens - stateless authentication

### Log Viewer UI

**Dark GitHub Theme** (matches FollowThru's tools/log-viewer):
- Background: `#0d1117`
- Cards: `#161b22`
- Text: `#c9d1d9`
- Borders: `#30363d`
- Accent: `#58a6ff` (links, titles)
- Muted text: `#6e7681`

**Features:**
- Card-based expandable log entries (click to expand)
- Monospace fonts: `'Consolas', 'Monaco', monospace`
- Expand/collapse icons: ▶ / ▼
- Level colors:
  - info: `#58a6ff` (blue)
  - warn: `#d29922` (orange)
  - error: `#f85149` (red)
  - critical: `#da3633` (dark red)
- Environment and project badges
- Search with 300ms debounce
- Infinite scroll (500 log limit in view)
- Auto-refresh toggle (30-second interval)

---

## Common Patterns

### Adding Environment Field to a Table

When adding environment support to a new table:

1. **Update Schema** (`workers/api/src/lib/schema.ts`):
```typescript
export const myTable = sqliteTable('my_table', {
  // ... existing fields
  environment: text('environment').notNull().default('production'),
}, (table) => ({
  // ... existing indexes
  environmentIdx: index('idx_mytable_environment').on(table.environment),
  // Add composite index if needed
  projectEnvIdx: index('idx_mytable_project_env').on(table.projectId, table.environment),
}));
```

2. **Update Validation Schema** (`packages/shared/src/schemas.ts`):
```typescript
export const myTableSchema = z.object({
  // ... existing fields
  environment: z.enum(['preview', 'production']).default('production'),
});
```

3. **Update API Route** (`workers/api/src/routes/my-route.ts`):
```typescript
// Add environment to data object
const data = {
  // ... existing fields
  environment: validatedData.environment,
};
```

4. **Update Database Functions** (`workers/api/src/lib/db.ts`):
```typescript
export async function getMyData(db, filters: { environment?: string }) {
  const conditions = [];

  if (filters.environment) {
    conditions.push(eq(schema.myTable.environment, filters.environment));
  }

  // ... rest of query
}
```

5. **Generate & Apply Migration** (USER ONLY):
```bash
make db-update
```

### Creating a New API Route

1. **Create Route File** (`workers/api/src/routes/my-route.ts`):
```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { mySchema } from '@project-monitoring/shared/schemas';
import { basicAuth } from '../lib/auth';

const app = new Hono();

app.post('/', basicAuth, zValidator('json', mySchema), async (c) => {
  const data = c.req.valid('json');
  // Handle request
  return c.json({ success: true });
});

export default app;
```

2. **Add to Main App** (`workers/api/src/index.ts`):
```typescript
import myRoute from './routes/my-route';

app.route('/api/my-route', myRoute);
```

3. **Create Validation Schema** (`packages/shared/src/schemas.ts`):
```typescript
export const mySchema = z.object({
  // Define fields with validation
});
```

4. **Create Dashboard Page** (`dashboard/app/routes/my-route.tsx`):
```typescript
import { type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Fetch data from API
}

export default function MyRoute() {
  // Render UI
}
```

### Handling Form Validation Errors

**Pattern Attribute Fix:**
```html
<!-- ❌ WRONG - Invalid regex in HTML5 pattern -->
<input pattern="[a-z0-9-]+" />

<!-- ✅ CORRECT - Escape the hyphen -->
<input pattern="[a-z0-9\-]+" />
```

The hyphen `-` inside a character class needs to be escaped or placed at the start/end to avoid being interpreted as a range operator.

---

## Git Workflow

### Safety Protocol

**NEVER:**
- ❌ Update git config
- ❌ Run destructive/irreversible git commands (force push, hard reset) without explicit user request
- ❌ Skip hooks (--no-verify, --no-gpg-sign) without explicit user request
- ❌ Force push to main/master (warn user if they request it)
- ❌ Commit changes unless user explicitly asks

**Commit Format** (when requested):
```
[Descriptive commit message]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Commit Process:**
1. Run `git status` and `git diff` in parallel
2. Analyze changes and draft commit message
3. Add files to staging
4. Create commit with standardized footer
5. Run `git status` to verify

**Pull Request Process** (when requested):
1. Run `git status`, `git diff`, check remote tracking
2. Analyze ALL commits in PR (not just latest)
3. Create PR with format:
```markdown
## Summary
<1-3 bullet points>

## Test plan
- [ ] Test item 1
- [ ] Test item 2

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Testing Requirements

**Before Marking Work Complete:**

**Schema Changes:**
- [ ] Migration generated and reviewed
- [ ] Migration applied to remote D1 (USER ONLY)
- [ ] Validation schemas updated
- [ ] API routes updated
- [ ] Database functions updated
- [ ] Dashboard pages updated if needed

**API Changes:**
- [ ] TypeScript types are correct (`make check`)
- [ ] Validation schemas match API contract
- [ ] Error handling is in place
- [ ] Tested with valid and invalid data

**UI Changes:**
- [ ] Tested in browser (USER ONLY for dev server)
- [ ] No console errors or warnings
- [ ] Responsive on mobile, tablet, desktop
- [ ] All clickable elements have hover states
- [ ] Matches design requirements exactly

**General:**
- [ ] No breaking changes to existing functionality
- [ ] Code follows project patterns
- [ ] Related files are updated (schemas, types, etc.)
- [ ] User can verify the changes work

---

## Design Philosophy

### When Implementing Features

**ASK FIRST, IMPLEMENT SECOND:**
- Suggest your approach before implementing
- Wait for user approval on design decisions
- Don't add features beyond what was requested
- Keep solutions minimal and clean

**Examples:**

❌ **DON'T:**
- Add animations when asked to "style" a button
- Redesign entire layouts when asked to fix alignment
- Add validation that wasn't requested
- Create elaborate loading states for simple operations

✅ **DO:**
- "I'll add a simple loading spinner - should it match the FollowThru style?"
- "This could benefit from error handling - should I add it?"
- "I notice similar code in 3 other places - should I fix those too?"

### When Copying from FollowThru

**EXACT MATCH REQUIRED:**
- Copy colors, fonts, spacing EXACTLY
- Don't "improve" or "enhance" the design
- Match the aesthetic completely
- If something seems off, ask before changing

**Verification Checklist:**
- [ ] Colors match hex codes exactly
- [ ] Fonts match (family, size, weight)
- [ ] Spacing matches (padding, margins, gaps)
- [ ] Layout structure is identical
- [ ] Hover states and transitions match
- [ ] Border radius and shadows match

---

## Common Issues and Solutions

### "Invalid character class" Regex Error

**Problem:** HTML5 pattern attribute with unescaped hyphen
```html
<input pattern="[a-z0-9-]+" />  <!-- ❌ WRONG -->
```

**Solution:** Escape the hyphen
```html
<input pattern="[a-z0-9\-]+" />  <!-- ✅ CORRECT -->
```

### Migration Command Not Found

**Problem:** `error: unknown command 'migrate'`

**Cause:** Using old drizzle-kit version or wrong config location

**Solution:**
1. Verify drizzle-kit version is 0.31+ in root package.json
2. Verify drizzle.config.ts is in ROOT directory
3. Run `yarn install` to update dependencies
4. Use `make db-migrate` not direct drizzle-kit commands

### Cannot Access Remote Database

**Problem:** Drizzle Studio or migrations fail to connect

**Solution:**
1. Verify Cloudflare credentials in root `.dev.vars`
2. Check `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, `CLOUDFLARE_API_TOKEN`
3. Ensure API token has "D1:Edit" permissions
4. Verify drizzle.config.ts uses `d1-http` driver

### Dashboard Shows 404

**Problem:** Dashboard routes not found after adding new route

**Solution:**
1. Verify route file is in `dashboard/app/routes/`
2. Check file naming: use `.tsx` extension
3. Ensure loader function is exported if using data
4. Check for TypeScript errors (`make check`)

---

## Project-Specific Context

### Why This Architecture?

**Cloudflare-First:**
- Monitoring platform should be as reliable as the apps it monitors
- Cloudflare's global network provides low latency
- D1 gives us SQLite compatibility with edge deployment
- Workers are cost-effective for API hosting

**Monorepo Structure:**
- Shared types ensure API/dashboard stay in sync
- Workspace dependencies simplify development
- Single repo for related components

**No User Accounts:**
- Internal tool, single admin access is sufficient
- Basic Auth is simple and secure enough
- Reduces complexity and attack surface

### Design Decisions

**Dark Theme for Log Viewer:**
- Reduces eye strain during long debugging sessions
- Matches developer tool aesthetics (GitHub, VS Code)
- Clear visual hierarchy with color-coded log levels

**Environment Filtering:**
- Essential for separating production and preview issues
- Global environments work because all projects are on Cloudflare
- Simplifies filtering logic (no nested environment-per-project)

**Infinite Scroll with 500 Log Limit:**
- Balance between performance and usability
- Most debugging needs recent logs
- Prevents memory issues in browser

---

## Getting Help

**If You're Stuck:**
1. Read this CLAUDE.md again - most answers are here
2. Check FollowThru's CLAUDE.md for similar patterns
3. Look at existing code for examples
4. Ask the user for clarification

**If Something's Unclear:**
- ✅ DO ask: "Should I follow the FollowThru pattern for this?"
- ✅ DO ask: "I see two approaches - which do you prefer?"
- ✅ DO ask: "This could be implemented multiple ways - what's your priority?"

**Remember:**
- Quality over speed
- Ask before assuming
- Verify before completing
- Copy exactly when told to copy
- Fix thoroughly, not superficially

---

**Last Updated:** 2025-10-31
**Maintained By:** Claude Code Assistant (following FollowThru patterns)
