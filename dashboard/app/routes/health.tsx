import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import Layout from "~/components/Layout";
import { createServerAPI } from "~/lib/api";
import { getEnv } from "~/utils/env.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const project = url.searchParams.get("project") || undefined;

  try {
    const env = getEnv(context);

    if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
      throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be configured');
    }

    const api = createServerAPI(
      env.ADMIN_USERNAME,
      env.ADMIN_PASSWORD,
      request,
      context
    );
    const response = await api.getHealthChecks({ project });
    const projects = await api.getProjects();
    return json({ healthChecks: response.data, projects: projects.data });
  } catch (error: any) {
    return json({ healthChecks: [], projects: [], error: error.message });
  }
}

export default function Health() {
  const { healthChecks, projects, error } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#c9d1d9' }}>Health Monitoring</h2>
          <p className="mt-1 text-sm" style={{ color: '#8b949e' }}>
            Monitor system health across projects
          </p>
        </div>

        {/* Filters */}
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', padding: '1rem' }}>
          <div>
            <label className="block text-sm font-medium" style={{ color: '#c9d1d9' }}>
              Project
            </label>
            <select
              style={{
                background: '#0d1117',
                border: '1px solid #30363d',
                color: '#c9d1d9',
                padding: '0.375rem 0.75rem',
                borderRadius: '6px',
                width: '100%',
                maxWidth: '28rem',
                marginTop: '0.25rem',
                fontSize: '0.875rem'
              }}
              value={searchParams.get("project") || ""}
              onChange={(e) => handleFilterChange("project", e.target.value)}
            >
              <option value="">All Projects</option>
              {projects.map((project: any) => (
                <option key={project.slug} value={project.slug}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Health Checks List */}
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', overflow: 'hidden' }}>
          {error && (
            <div style={{ padding: '0.75rem 1rem', background: '#3a1f1f', borderBottom: '1px solid #da3633' }}>
              <p className="text-sm" style={{ color: '#f85149' }}>Error: {error}</p>
            </div>
          )}

          {healthChecks.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#8b949e' }}>
              No health checks found
            </div>
          ) : (
            <ul style={{ borderTop: 'none' }}>
              {healthChecks.map((check: any) => (
                <li
                  key={check.id}
                  style={{
                    padding: '1rem',
                    borderTop: '1px solid #30363d',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#0d1117'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          style={
                            check.status === "healthy"
                              ? { background: '#1b3c1b', color: '#3fb950', border: '1px solid #238636' }
                              : check.status === "degraded"
                              ? { background: '#352f1b', color: '#d29922', border: '1px solid #bf8700' }
                              : { background: '#3a1f1f', color: '#f85149', border: '1px solid #da3633' }
                          }
                        >
                          {check.status}
                        </span>
                        {check.responseTime && (
                          <span className="text-xs" style={{ color: '#8b949e' }}>
                            {check.responseTime}ms
                          </span>
                        )}
                      </div>

                      {check.metadata && (
                        <details className="mt-2">
                          <summary
                            className="text-xs cursor-pointer"
                            style={{ color: '#58a6ff' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#79c0ff'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#58a6ff'}
                          >
                            View details
                          </summary>
                          <pre
                            className="mt-2 text-xs p-2 rounded overflow-x-auto"
                            style={{ background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d' }}
                          >
                            {check.metadata}
                          </pre>
                        </details>
                      )}

                      <p className="mt-1 text-xs" style={{ color: '#8b949e' }}>
                        {new Date(check.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
}
