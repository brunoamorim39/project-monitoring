import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { useState, useEffect, useRef, useCallback } from "react";
import Layout from "~/components/Layout";
import { getEnv } from "~/utils/env.server";
import { createServerAPI } from "~/lib/api";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const project = url.searchParams.get("project") || undefined;
  const environment = url.searchParams.get("environment") || undefined;
  const level = url.searchParams.get("level") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const env = getEnv(context);
  const api = createServerAPI(
    env.ADMIN_USERNAME || 'admin',
    env.ADMIN_PASSWORD || 'totally-secure-password'
  );

  const [logsResponse, projectsResponse] = await Promise.all([
    api.getLogs({ project, environment, level, search, limit: 50, offset }),
    api.getProjects(),
  ]);

  return json({
    logs: logsResponse.data,
    projects: projectsResponse.data,
    hasMore: logsResponse.data.length === 50,
  });
}

export default function Logs() {
  const initialData = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState(initialData.logs);
  const [projects] = useState(initialData.projects);
  const [hasMore, setHasMore] = useState(initialData.hasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>();
  const observerTarget = useRef<HTMLDivElement | null>(null);

  // Sync logs with initial data when search params change
  useEffect(() => {
    setLogs(initialData.logs);
    setHasMore(initialData.hasMore);
  }, [initialData]);

  // Auto-refresh interval (30 seconds)
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      const params = new URLSearchParams(searchParams);
      params.delete("offset");
      setSearchParams(params, { replace: true });
      setLastRefresh(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, searchParams, setSearchParams]);

  // Filter handlers
  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("offset");
    setSearchParams(params, { replace: true });
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      handleFilterChange("search", value);
    }, 300);
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setSearchParams({});
  };

  // Load more logs (infinite scroll)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    const params = new URLSearchParams(searchParams);
    params.set("offset", logs.length.toString());

    try {
      const response = await fetch(`/logs?${params.toString()}`, {
        headers: { "Accept": "application/json" },
      });
      const data = await response.json();

      setLogs((prev: any[]) => [...prev, ...data.logs]);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error("Failed to load more logs:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, searchParams, logs.length]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  // Toggle log expansion
  const toggleLog = (logId: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false });
  };

  // Get level color
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'info': return '#58a6ff';
      case 'warn': return '#d29922';
      case 'error': return '#f85149';
      case 'critical': return '#da3633';
      default: return '#6e7681';
    }
  };

  // Limit logs to 500
  const displayLogs = logs.slice(Math.max(0, logs.length - 500));

  return (
    <Layout>
      <style>{`
        .log-viewer-container {
          background: #0d1117;
          min-height: calc(100vh - 4rem);
          color: #c9d1d9;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
          display: flex;
          flex-direction: column;
          border-radius: 8px;
          overflow: hidden;
        }

        .log-header {
          background: #161b22;
          padding: 1rem;
          border-bottom: 1px solid #30363d;
        }

        .log-header h1 {
          font-size: 1.2rem;
          font-weight: 600;
          color: #58a6ff;
          margin-bottom: 0.5rem;
        }

        .log-header-info {
          font-size: 0.875rem;
          color: #6e7681;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .log-controls {
          background: #161b22;
          padding: 1rem;
          border-bottom: 1px solid #30363d;
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: center;
        }

        .log-controls select,
        .log-controls input[type="text"] {
          background: #0d1117;
          border: 1px solid #30363d;
          color: #c9d1d9;
          padding: 0.375rem 0.75rem;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .log-controls select.required {
          font-size: 1rem;
          font-weight: 600;
          padding: 0.5rem 1rem;
          min-width: 200px;
          border: 2px solid #388bfd;
          background: #0d1117;
        }

        .log-controls select.required:focus {
          outline: none;
          border-color: #58a6ff;
          box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2);
        }

        .log-controls select:focus,
        .log-controls input[type="text"]:focus {
          outline: none;
          border-color: #58a6ff;
        }

        .log-controls input[type="text"] {
          flex: 1;
          min-width: 200px;
        }

        .log-controls button {
          background: #21262d;
          border: 1px solid #30363d;
          color: #c9d1d9;
          padding: 0.375rem 1rem;
          border-radius: 6px;
          font-size: 0.875rem;
          cursor: pointer;
          transition: background 0.2s;
        }

        .log-controls button:hover {
          background: #30363d;
        }

        .log-controls button.active {
          background: #238636;
          border-color: #238636;
          color: #ffffff;
        }

        .log-controls label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .log-controls input[type="checkbox"] {
          cursor: pointer;
        }

        .log-container {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
        }

        .log-entry {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
          margin-bottom: 0.5rem;
          overflow: hidden;
        }

        .log-summary {
          padding: 0.75rem 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 1rem;
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 0.875rem;
          transition: background 0.2s;
        }

        .log-summary:hover {
          background: #0d1117;
        }

        .log-entry.expanded .log-summary {
          background: #0d1117;
        }

        .expand-icon {
          color: #6e7681;
          user-select: none;
          min-width: 12px;
        }

        .log-time {
          color: #6e7681;
          min-width: 70px;
        }

        .log-level {
          font-weight: 600;
          min-width: 80px;
        }

        .log-message {
          flex: 1;
          color: #c9d1d9;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .log-env-badge {
          font-size: 0.75rem;
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
          background: #21262d;
          color: #c9d1d9;
          font-weight: 500;
        }

        .log-project-badge {
          font-size: 0.75rem;
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
          background: #1f6feb;
          color: #ffffff;
          font-weight: 500;
        }

        .log-details {
          padding: 1rem;
          border-top: 1px solid #30363d;
          background: #0d1117;
          display: none;
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 0.813rem;
        }

        .log-entry.expanded .log-details {
          display: block;
        }

        .log-section {
          margin-bottom: 1rem;
        }

        .log-section:last-child {
          margin-bottom: 0;
        }

        .log-section-title {
          color: #58a6ff;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .log-section-content {
          color: #c9d1d9;
          word-break: break-all;
        }

        .log-context {
          background: #161b22;
          padding: 0.75rem;
          border-radius: 4px;
          border-left: 3px solid #58a6ff;
          white-space: pre-wrap;
          overflow-x: auto;
        }

        .loading-indicator {
          text-align: center;
          padding: 1rem;
          color: #6e7681;
          font-size: 0.875rem;
        }

        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
          color: #6e7681;
        }

        .empty-state svg {
          width: 48px;
          height: 48px;
          margin: 0 auto 1rem;
          opacity: 0.5;
          color: #6e7681;
        }
      `}</style>

      <div className="log-viewer-container">
        <div className="log-header">
          <h1>Project Monitoring Logs</h1>
          <div className="log-header-info">
            <span>{displayLogs.length} logs loaded</span>
            {autoRefresh && <span>Auto-refresh: ON (last: {lastRefresh.toLocaleTimeString()})</span>}
          </div>
        </div>

        <div className="log-controls">
          <select
            className="required"
            value={searchParams.get("project") || ""}
            onChange={(e) => handleFilterChange("project", e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map((project: any) => (
              <option key={project.id} value={project.slug}>
                {project.name}
              </option>
            ))}
          </select>

          <select
            className="required"
            value={searchParams.get("environment") || ""}
            onChange={(e) => handleFilterChange("environment", e.target.value)}
          >
            <option value="">All Environments</option>
            <option value="preview">Preview</option>
            <option value="production">Production</option>
          </select>

          <select
            value={searchParams.get("level") || ""}
            onChange={(e) => handleFilterChange("level", e.target.value)}
          >
            <option value="">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>

          <input
            type="text"
            placeholder="Search logs..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
          />

          <label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (30s)
          </label>

          <button onClick={handleClearFilters}>
            Clear Filters
          </button>
        </div>

        <div className="log-container">
          {displayLogs.length === 0 ? (
            <div className="empty-state">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No logs found</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Try adjusting your filters or create some activity</p>
            </div>
          ) : (
            <>
              {displayLogs.map((log: any) => {
                const isExpanded = expandedLogs.has(log.id);
                const project = projects.find((p: any) => p.id === log.projectId);
                return (
                  <div
                    key={log.id}
                    className={`log-entry ${isExpanded ? 'expanded' : ''}`}
                  >
                    <div
                      className="log-summary"
                      onClick={() => toggleLog(log.id)}
                    >
                      <span className="expand-icon">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <span className="log-time">
                        {formatTime(log.timestamp)}
                      </span>
                      <span
                        className="log-level"
                        style={{ color: getLevelColor(log.level) }}
                      >
                        {log.level.toUpperCase()}
                      </span>
                      <span className="log-message">
                        {log.message}
                      </span>
                      {project && (
                        <span className="log-project-badge">
                          {project.name}
                        </span>
                      )}
                      <span className="log-env-badge">
                        {log.environment}
                      </span>
                    </div>

                    <div className="log-details">
                      <div className="log-section">
                        <div className="log-section-title">Message</div>
                        <div className="log-section-content">{log.message}</div>
                      </div>

                      {log.context && (
                        <div className="log-section">
                          <div className="log-section-title">Context</div>
                          <pre className="log-context">
                            {JSON.stringify(JSON.parse(log.context), null, 2)}
                          </pre>
                        </div>
                      )}

                      <div className="log-section">
                        <div className="log-section-title">Metadata</div>
                        <div className="log-section-content">
                          <div>Project: {project?.name || log.projectId}</div>
                          <div>Environment: {log.environment}</div>
                          <div>Level: {log.level}</div>
                          <div>Timestamp: {new Date(log.timestamp).toISOString()}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {hasMore && (
                <div ref={observerTarget} className="loading-indicator">
                  {isLoadingMore ? "Loading more logs..." : "Scroll for more"}
                </div>
              )}

              {!hasMore && displayLogs.length > 0 && (
                <div className="loading-indicator">
                  End of results ({displayLogs.length} logs)
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
