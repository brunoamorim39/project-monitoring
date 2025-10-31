# R2 Hybrid Storage Architecture Plan

## Overview

Migrate log storage to a hybrid architecture combining:
- **R2 (Cloudflare Object Storage)**: Store full log content for scalability and cost efficiency
- **D1 (SQLite Database)**: Store metadata and indexes for fast filtering and search
- **Real-time Preview**: Maintain real-time log viewing for preview environment testing/troubleshooting

## Current Architecture

```
┌─────────────────────────────────────┐
│         All Data in D1              │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Logs Table                  │  │
│  │  - id, projectId, level      │  │
│  │  - message (full text)       │  │
│  │  - context (JSON blob)       │  │
│  │  - timestamp, environment    │  │
│  └──────────────────────────────┘  │
│                                     │
│  Issues:                            │
│  - D1 row size limits             │
│  - Expensive for large volumes     │
│  - No efficient retention policy   │
└─────────────────────────────────────┘
```

## Proposed Hybrid Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Hybrid Storage                           │
│                                                              │
│  ┌────────────────────┐        ┌─────────────────────────┐ │
│  │   D1 (Metadata)   │        │    R2 (Full Content)    │ │
│  │                    │        │                         │ │
│  │  logs_metadata:    │        │  /logs/{yyyy}/{mm}/     │ │
│  │  - id             │        │    {project}/{env}/     │ │
│  │  - projectId      │        │    {timestamp}.json     │ │
│  │  - environment    │        │                         │ │
│  │  - level          │        │  Contains:              │ │
│  │  - preview (first │        │  - Full message         │ │
│  │    200 chars)     │        │  - Full context JSON    │ │
│  │  - timestamp      │        │  - All metadata         │ │
│  │  - r2Key          │        │                         │ │
│  │  - hasContext     │        │                         │ │
│  └────────────────────┘        └─────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Dual-Write Mode (Current + R2)
**Goal**: Write to both D1 and R2 without breaking existing functionality

1. **Add R2 binding** to wrangler.toml:
   ```toml
   [[r2_buckets]]
   binding = "LOGS_BUCKET"
   bucket_name = "project-monitoring-logs"
   ```

2. **Update log submission** (workers/api/src/routes/logs.ts):
   - Write full log content to R2: `/logs/YYYY/MM/PROJECT/ENV/TIMESTAMP-ID.json`
   - Write metadata + preview to D1 (new `logs_metadata` table)
   - Keep writing to old `logs` table (for rollback safety)

3. **Keep current query path** using D1 `logs` table
   - No changes to dashboard
   - Existing real-time viewing works as-is

**Duration**: 1-2 days
**Risk**: Low (additive only)

### Phase 2: Hybrid Query Mode
**Goal**: Query from D1 metadata, fetch full content from R2 on expand

1. **Update log query handlers**:
   - Query `logs_metadata` table instead of `logs`
   - Return preview (first 200 chars) for list view
   - Fetch from R2 only when log is expanded

2. **Add R2 fetch endpoint**:
   ```typescript
   admin.get('/logs/:id/full', async (c) => {
     const log = await getLogMetadata(db, c.req.param('id'));
     const content = await c.env.LOGS_BUCKET.get(log.r2Key);
     return c.json(await content.json());
   });
   ```

3. **Update dashboard** ([logs.tsx](dashboard/app/routes/logs.tsx)):
   - Show preview in list view (from metadata)
   - Fetch full content when user expands log
   - Cache expanded logs in React state

**Duration**: 2-3 days
**Risk**: Medium (requires frontend changes)

### Phase 3: Real-time Preview Support
**Goal**: Maintain real-time log viewing for preview environment

**Option A: WebSocket Tailing (Recommended)**
```typescript
// Worker maintains recent logs in memory for preview env
const recentPreviewLogs = new Map(); // Last 100 logs for each project

// On log submission to preview:
if (environment === 'preview') {
  recentPreviewLogs.set(logId, fullLog);
  // Broadcast to connected WebSocket clients
  broadcastToClients(projectId, fullLog);
}

// Dashboard WebSocket connection:
const ws = new WebSocket('/api/v1/admin/logs/stream?project=followthru');
ws.onmessage = (event) => {
  const log = JSON.parse(event.data);
  setLogs(prev => [log, ...prev]);
};
```

**Option B: Short-Polling (Simpler)**
```typescript
// Dashboard polls every 2 seconds when viewing preview:
useEffect(() => {
  if (environment === 'preview' && autoRefresh) {
    const interval = setInterval(() => {
      fetch(`/api/v1/admin/logs?environment=preview&after=${lastTimestamp}`)
        .then(res => res.json())
        .then(data => setLogs(prev => [...data.logs, ...prev]));
    }, 2000);
    return () => clearInterval(interval);
  }
}, [environment, autoRefresh, lastTimestamp]);
```

**Recommendation**: Start with Option B (polling) for simplicity. Add WebSocket later if needed.

**Duration**: 1-2 days
**Risk**: Low (polling) / Medium (WebSocket)

### Phase 4: Migration & Cleanup
**Goal**: Migrate old logs to R2 and remove old table

1. **Migration script**:
   ```typescript
   // scripts/migrate-logs-to-r2.ts
   const oldLogs = await db.select().from(logs).all();

   for (const log of oldLogs) {
     // Write to R2
     const r2Key = `logs/${year}/${month}/${project}/${env}/${timestamp}-${id}.json`;
     await env.LOGS_BUCKET.put(r2Key, JSON.stringify(log));

     // Write metadata to new table
     await db.insert(logsMetadata).values({
       id: log.id,
       projectId: log.projectId,
       environment: log.environment,
       level: log.level,
       preview: log.message.substring(0, 200),
       timestamp: log.timestamp,
       r2Key,
       hasContext: !!log.context,
     });
   }
   ```

2. **Drop old table** after verification:
   ```sql
   DROP TABLE logs;
   ```

**Duration**: 1 day
**Risk**: Low (if phases 1-3 are stable)

## Data Schema

### D1: logs_metadata Table
```sql
CREATE TABLE logs_metadata (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  environment TEXT NOT NULL CHECK(environment IN ('preview', 'production')),
  level TEXT NOT NULL CHECK(level IN ('info', 'warn', 'error', 'critical')),
  preview TEXT NOT NULL,          -- First 200 chars of message
  timestamp INTEGER NOT NULL,
  r2Key TEXT NOT NULL,            -- Path in R2 bucket
  hasContext INTEGER NOT NULL,    -- 1 if log has context JSON
  createdAt INTEGER DEFAULT (unixepoch()),

  FOREIGN KEY (projectId) REFERENCES projects(id)
);

CREATE INDEX idx_logs_metadata_project ON logs_metadata(projectId);
CREATE INDEX idx_logs_metadata_timestamp ON logs_metadata(timestamp DESC);
CREATE INDEX idx_logs_metadata_level ON logs_metadata(level);
CREATE INDEX idx_logs_metadata_env ON logs_metadata(environment);
CREATE INDEX idx_logs_metadata_preview ON logs_metadata(preview); -- For text search
```

### R2: Object Structure
```json
{
  "id": "uuid-here",
  "projectId": "proj-123",
  "environment": "preview",
  "level": "error",
  "message": "Full error message here, no truncation",
  "context": {
    "userId": "user-456",
    "requestId": "req-789",
    "custom": "data"
  },
  "timestamp": 1699999999999
}
```

**R2 Key Format**: `logs/{YYYY}/{MM}/{PROJECT_SLUG}/{ENV}/{TIMESTAMP}-{ID}.json`

**Example**: `logs/2025/10/followthru/preview/1730377200000-550e8400.json`

## Retention Policy

### Preview Environment
- **D1 Metadata**: 7 days
- **R2 Content**: 30 days
- **Rationale**: Preview is for testing, don't need long history

### Production Environment
- **D1 Metadata**: 90 days
- **R2 Content**: 1 year
- **Rationale**: Production needs longer audit trail

### Implementation
```typescript
// Scheduled worker (runs daily at 2 AM)
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const db = getDb(env.DB);

    // Delete old preview metadata (7 days)
    const previewCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    await db.delete(logsMetadata)
      .where(and(
        eq(logsMetadata.environment, 'preview'),
        lt(logsMetadata.timestamp, previewCutoff)
      ));

    // Delete old production metadata (90 days)
    const prodCutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);
    await db.delete(logsMetadata)
      .where(and(
        eq(logsMetadata.environment, 'production'),
        lt(logsMetadata.timestamp, prodCutoff)
      ));

    // R2 lifecycle rules (set in dashboard):
    // - logs/*/*/*/preview/* -> Delete after 30 days
    // - logs/*/*/*/production/* -> Delete after 365 days
  }
};
```

## Cost Analysis

### Cloudflare Free Tier (Current Usage)
- **Workers**: 10M requests/day free (100K requests/day = well under limit)
- **D1**: 5M reads/day + 100K writes/day free
- **R2**: 10GB storage free + 1M Class A operations/month free
- **Current Cost**: **$0/month** (well within free tier)

### Cost at Scale (Future)
Even with significant growth, costs remain minimal:
- **D1**: First 5 billion reads free per month
- **R2 Storage**: First 10GB free, then $0.015/GB/month
- **R2 Operations**: First 1M Class A operations free per month

**Example at 1M logs/day**:
- D1 storage: Metadata only (~100 bytes/log) = negligible
- R2 storage: ~30GB/month after retention = ~$0.30/month
- R2 operations: Well under 1M/month with read-on-expand pattern = $0/month
- **Total**: **~$0.30/month**

**Key Benefits**:
- ✅ No row size limits
- ✅ Scales to millions of logs
- ✅ Efficient retention policies
- ✅ Better performance (D1 queries only metadata)
- ✅ Essentially free for your use case

## Search & Filtering

### Fast Operations (D1 metadata only)
- Filter by project, environment, level → **Fast** (indexed)
- Filter by timestamp range → **Fast** (indexed)
- Basic text search on preview (first 200 chars) → **OK** (indexed)
- Load list view → **Fast** (no R2 fetches)

### Slower Operations (R2 required)
- Full-text search in message → **Slow** (needs R2 scan)
- Search in context JSON → **Slow** (needs R2 scan)
- Expand log details → **OK** (single R2 fetch)

### Advanced Search (Future Enhancement)
If full-text search becomes important:
1. Store searchable text in separate D1 column (FTS5 table)
2. Use R2 Select API for server-side filtering
3. Add Elasticsearch/similar for advanced search (overkill for now)

**For MVP**: Limit search to preview text (first 200 chars). Most debugging doesn't need full context search.

## Real-time Viewing Flow

### Preview Environment (Real-time)
```
User opens log viewer → Dashboard polls every 2s for new logs
                      ↓
                [GET /api/v1/admin/logs?environment=preview&after={timestamp}]
                      ↓
                Returns metadata from D1 (fast)
                      ↓
                User expands log → Fetch full content from R2
```

### Production Environment (Historical)
```
User opens log viewer → Load last 50 logs from D1 metadata
                      ↓
                User scrolls → Load more metadata (infinite scroll)
                      ↓
                User expands log → Fetch full content from R2
```

## Rollback Strategy

### Phase 1-2: Easy Rollback
- Old `logs` table still exists
- Switch back to old query path
- No data loss

### Phase 3-4: One-Way Migration
- Once old table is dropped, no easy rollback
- **Mitigation**: Test thoroughly in phases 1-2
- **Backup**: Export D1 before dropping table

## Testing Plan

### Phase 1 Testing
- [ ] Submit logs to API, verify R2 writes succeed
- [ ] Check R2 key format is correct
- [ ] Verify metadata in new table matches R2 content
- [ ] Confirm old table still works

### Phase 2 Testing
- [ ] Query logs, verify preview shows first 200 chars
- [ ] Expand log, verify full content loads from R2
- [ ] Test filtering (project, environment, level)
- [ ] Test search on preview text
- [ ] Test infinite scroll

### Phase 3 Testing
- [ ] Open preview log viewer, verify polling works
- [ ] Submit logs from FollowThru, see them appear in real-time
- [ ] Test auto-refresh toggle
- [ ] Verify production logs don't enable polling
- [ ] Test with 0 logs, 1 log, 100 logs

### Phase 4 Testing
- [ ] Run migration script on copy of production DB
- [ ] Verify all logs migrated correctly
- [ ] Compare old vs new table counts
- [ ] Test queries on migrated data
- [ ] Drop old table (after 1 week of stability)

## Timeline

| Phase | Duration | Risk | Dependencies |
|-------|----------|------|--------------|
| Phase 1: Dual-Write | 1-2 days | Low | R2 binding setup |
| Phase 2: Hybrid Query | 2-3 days | Medium | Phase 1 complete |
| Phase 3: Real-time Preview | 1-2 days | Low | Phase 2 complete |
| Phase 4: Migration | 1 day | Low | Phases 1-3 stable |
| **Total** | **5-8 days** | | |

## Open Questions

1. **Search Scope**: Is searching first 200 chars sufficient, or do we need full-text search?
   - **Decision**: Start with preview search, add full search if requested

2. **WebSocket vs Polling**: Which is preferred for real-time preview?
   - **Decision**: Start with polling (simpler), upgrade if latency is an issue

3. **Retention Periods**: Are 7 days (preview) / 90 days (production) acceptable?
   - **Decision**: User confirmed hybrid setup makes sense, retention TBD

4. **Error/Feedback Migration**: Should errors and feedback follow same pattern?
   - **Decision**: Focus on logs first (highest volume), extend pattern later

## Next Steps

1. **User Review**: Get approval on architecture and timeline
2. **Setup R2 Bucket**: Create bucket in Cloudflare dashboard
3. **Start Phase 1**: Add R2 binding and dual-write logic
4. **Monitor Costs**: Track R2 usage during phases 1-2
5. **Iterate**: Adjust retention and polling intervals based on usage
