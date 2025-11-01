import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import Layout from "~/components/Layout";
import { createServerAPI } from "~/lib/api";
import { getEnv } from "~/utils/env.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const project = url.searchParams.get("project") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const type = url.searchParams.get("type") || undefined;

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
    const response = await api.getFeedback({ project, status, type });
    const projects = await api.getProjects();
    return json({ feedback: response.data, projects: projects.data });
  } catch (error: any) {
    return json({ feedback: [], projects: [], error: error.message });
  }
}

export default function Feedback() {
  const { feedback, projects, error } = useLoaderData<typeof loader>();
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
          <h2 className="text-2xl font-bold" style={{ color: '#58a6ff' }}>Feedback</h2>
          <p className="mt-1 text-sm" style={{ color: '#8b949e' }}>
            View and manage feedback from all projects
          </p>
        </div>

        {/* Filters */}
        <div className="rounded-lg p-4" style={{ background: '#161b22', border: '1px solid #30363d' }}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium" style={{ color: '#c9d1d9' }}>
                Project
              </label>
              <select
                className="mt-1 block w-full rounded-md shadow-sm sm:text-sm"
                style={{ background: '#0d1117', border: '1px solid #30363d', color: '#c9d1d9', padding: '0.375rem 0.75rem' }}
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

            <div>
              <label className="block text-sm font-medium" style={{ color: '#c9d1d9' }}>
                Status
              </label>
              <select
                className="mt-1 block w-full rounded-md shadow-sm sm:text-sm"
                style={{ background: '#0d1117', border: '1px solid #30363d', color: '#c9d1d9', padding: '0.375rem 0.75rem' }}
                value={searchParams.get("status") || ""}
                onChange={(e) => handleFilterChange("status", e.target.value)}
              >
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="wont_fix">Won't Fix</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium" style={{ color: '#c9d1d9' }}>
                Type
              </label>
              <select
                className="mt-1 block w-full rounded-md shadow-sm sm:text-sm"
                style={{ background: '#0d1117', border: '1px solid #30363d', color: '#c9d1d9', padding: '0.375rem 0.75rem' }}
                value={searchParams.get("type") || ""}
                onChange={(e) => handleFilterChange("type", e.target.value)}
              >
                <option value="">All Types</option>
                <option value="bug">Bug</option>
                <option value="feature">Feature</option>
                <option value="question">Question</option>
              </select>
            </div>
          </div>
        </div>

        {/* Feedback List */}
        <div className="rounded-lg overflow-hidden" style={{ background: '#161b22', border: '1px solid #30363d' }}>
          {error && (
            <div className="px-4 py-3" style={{ background: '#da3633', borderBottom: '1px solid #f85149' }}>
              <p className="text-sm" style={{ color: '#ffd7d5' }}>Error: {error}</p>
            </div>
          )}

          {feedback.length === 0 ? (
            <div className="px-4 py-8 text-center" style={{ color: '#8b949e' }}>
              No feedback found
            </div>
          ) : (
            <ul>
              {feedback.map((item: any) => (
                <li
                  key={item.id}
                  className="px-4 py-4"
                  style={{ borderTop: '1px solid #30363d', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#0d1117'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            background: item.type === "bug" ? '#3a1f1f' : item.type === "feature" ? '#1b3c1b' : '#1c2d41',
                            color: item.type === "bug" ? '#f85149' : item.type === "feature" ? '#3fb950' : '#58a6ff',
                            border: `1px solid ${item.type === "bug" ? '#da3633' : item.type === "feature" ? '#238636' : '#388bfd'}`
                          }}
                        >
                          {item.type}
                        </span>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            background: item.status === "open" ? '#352f1b' : item.status === "in_progress" ? '#1c2d41' : item.status === "resolved" ? '#1b3c1b' : '#21262d',
                            color: item.status === "open" ? '#d29922' : item.status === "in_progress" ? '#58a6ff' : item.status === "resolved" ? '#3fb950' : '#8b949e',
                            border: `1px solid ${item.status === "open" ? '#bf8700' : item.status === "in_progress" ? '#388bfd' : item.status === "resolved" ? '#238636' : '#30363d'}`
                          }}
                        >
                          {item.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium" style={{ color: '#c9d1d9' }}>
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="mt-1 text-sm line-clamp-2" style={{ color: '#8b949e' }}>
                          {item.description}
                        </p>
                      )}
                      <div className="mt-2 text-xs" style={{ color: '#8b949e' }}>
                        {item.userName && <span>{item.userName} • </span>}
                        {item.userEmail && <span>{item.userEmail} • </span>}
                        {new Date(item.createdAt).toLocaleString()}
                      </div>
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
