import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import Layout from "~/components/Layout";
import { createServerAPI } from "~/lib/api";
import { getEnv } from "~/utils/env.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Overview - Project Monitor" },
    { name: "description", content: "Project monitoring dashboard" },
  ];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  try {
    // Get environment variables using helper that handles both dev and production
    const env = getEnv(context);

    if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
      throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be configured');
    }

    const api = createServerAPI(env.ADMIN_USERNAME, env.ADMIN_PASSWORD, request, context);
    const stats = await api.getStats();
    const projects = await api.getProjects();
    return json({ stats: stats.data, projects: projects.data });
  } catch (error: any) {
    console.error("Failed to load dashboard data:", error);
    return json({ stats: null, projects: [], error: error.message });
  }
}

export default function Index() {
  const { stats, projects, error } = useLoaderData<typeof loader>();

  if (error) {
    return (
      <Layout>
        <div style={{ background: '#da3633', border: '1px solid #f85149', borderRadius: '6px', padding: '1rem' }}>
          <p style={{ color: '#ffd7d5' }}>Failed to load dashboard: {error}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#58a6ff' }}>Dashboard Overview</h2>
          <p className="mt-1 text-sm" style={{ color: '#8b949e' }}>
            Monitor all your projects in one place
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Total Projects"
            value={stats?.totalProjects || 0}
            color="blue"
          />
          <StatCard
            title="Open Feedback"
            value={stats?.openFeedback || 0}
            color="yellow"
          />
          <StatCard
            title="Unresolved Errors"
            value={stats?.unresolvedErrors || 0}
            color="red"
          />
          <StatCard
            title="Total Feedback"
            value={stats?.totalFeedback || 0}
            color="green"
          />
          <StatCard
            title="Total Errors"
            value={stats?.totalErrors || 0}
            color="orange"
          />
          <StatCard
            title="Total Logs"
            value={stats?.totalLogs || 0}
            color="purple"
          />
        </div>

        {/* Projects List */}
        <div style={{ background: '#161b22', borderRadius: '6px', border: '1px solid #30363d' }}>
          <div className="px-4 py-5 sm:px-6" style={{ borderBottom: '1px solid #30363d' }}>
            <h3 className="text-lg font-medium" style={{ color: '#c9d1d9' }}>Projects</h3>
          </div>
          <ul style={{ borderTop: 'none' }}>
            {projects.length === 0 ? (
              <li className="px-4 py-4" style={{ color: '#8b949e' }}>No projects yet</li>
            ) : (
              projects.map((project: any) => (
                <li
                  key={project.id}
                  className="px-4 py-4"
                  style={{
                    borderTop: '1px solid #30363d',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#0d1117'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#c9d1d9' }}>
                        {project.name}
                      </p>
                      <p className="text-sm" style={{ color: '#8b949e' }}>/{project.slug}</p>
                    </div>
                    <div className="text-sm" style={{ color: '#8b949e' }}>
                      Created {new Date(project.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </Layout>
  );
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  const colorStyles: Record<string, { background: string; color: string; border: string }> = {
    blue: { background: '#1c2d41', color: '#58a6ff', border: '1px solid #388bfd' },
    yellow: { background: '#352f1b', color: '#d29922', border: '1px solid #bf8700' },
    red: { background: '#3a1f1f', color: '#f85149', border: '1px solid #da3633' },
    green: { background: '#1b3c1b', color: '#3fb950', border: '1px solid #238636' },
    orange: { background: '#3a2a1b', color: '#db6d28', border: '1px solid #bd561d' },
    purple: { background: '#2d2440', color: '#a371f7', border: '1px solid #8957e5' },
  };

  return (
    <div
      className="rounded-lg p-6"
      style={{
        ...colorStyles[color],
        transition: 'transform 0.2s'
      }}
    >
      <p className="text-sm font-medium opacity-75">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
