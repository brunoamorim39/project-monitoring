import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import Layout from "~/components/Layout";
import { api } from "~/lib/api";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const project = url.searchParams.get("project") || undefined;

  try {
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
          <h2 className="text-2xl font-bold text-gray-900">Health Monitoring</h2>
          <p className="mt-1 text-sm text-gray-500">
            Monitor system health across projects
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Project
            </label>
            <select
              className="mt-1 block w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {error && (
            <div className="px-4 py-3 bg-red-50 border-b border-red-200">
              <p className="text-sm text-red-800">Error: {error}</p>
            </div>
          )}

          {healthChecks.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No health checks found
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {healthChecks.map((check: any) => (
                <li key={check.id} className="px-4 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            check.status === "healthy"
                              ? "bg-green-100 text-green-800"
                              : check.status === "degraded"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {check.status}
                        </span>
                        {check.responseTime && (
                          <span className="text-xs text-gray-500">
                            {check.responseTime}ms
                          </span>
                        )}
                      </div>

                      {check.metadata && (
                        <details className="mt-2">
                          <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                            View details
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                            {check.metadata}
                          </pre>
                        </details>
                      )}

                      <p className="mt-1 text-xs text-gray-500">
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
