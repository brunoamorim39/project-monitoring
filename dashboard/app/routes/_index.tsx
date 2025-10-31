import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import Layout from "~/components/Layout";
import { createServerAPI } from "~/lib/api";

export const meta: MetaFunction = () => {
  return [
    { title: "Overview - Project Monitor" },
    { name: "description", content: "Project monitoring dashboard" },
  ];
};

export async function loader({ context }: LoaderFunctionArgs) {
  try {
    const api = createServerAPI(
      context.cloudflare.env.ADMIN_USERNAME,
      context.cloudflare.env.ADMIN_PASSWORD
    );
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Failed to load dashboard: {error}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
          <p className="mt-1 text-sm text-gray-500">
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
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Projects</h3>
          </div>
          <ul className="divide-y divide-gray-200">
            {projects.length === 0 ? (
              <li className="px-4 py-4 text-gray-500">No projects yet</li>
            ) : (
              projects.map((project: any) => (
                <li key={project.id} className="px-4 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {project.name}
                      </p>
                      <p className="text-sm text-gray-500">/{project.slug}</p>
                    </div>
                    <div className="text-sm text-gray-500">
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
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
    red: "bg-red-50 text-red-700 border-red-200",
    green: "bg-green-50 text-green-700 border-green-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <div className={`border rounded-lg p-6 ${colorClasses[color]}`}>
      <p className="text-sm font-medium opacity-75">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
