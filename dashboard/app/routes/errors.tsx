import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import Layout from "~/components/Layout";
import { api } from "~/lib/api";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const project = url.searchParams.get("project") || undefined;
  const resolved = url.searchParams.get("resolved") || undefined;

  try {
    const response = await api.getErrors({
      project,
      resolved: resolved === "true" ? true : resolved === "false" ? false : undefined,
    });
    const projects = await api.getProjects();
    return json({ errors: response.data, projects: projects.data });
  } catch (error: any) {
    return json({ errors: [], projects: [], error: error.message });
  }
}

export default function Errors() {
  const { errors, projects, error } = useLoaderData<typeof loader>();
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
          <h2 className="text-2xl font-bold text-gray-900">Errors</h2>
          <p className="mt-1 text-sm text-gray-500">
            Track and manage errors across projects
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Project
              </label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
              <label className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={searchParams.get("resolved") || ""}
                onChange={(e) => handleFilterChange("resolved", e.target.value)}
              >
                <option value="">All</option>
                <option value="false">Unresolved</option>
                <option value="true">Resolved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Errors List */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {error && (
            <div className="px-4 py-3 bg-red-50 border-b border-red-200">
              <p className="text-sm text-red-800">Error: {error}</p>
            </div>
          )}

          {errors.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No errors found
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {errors.map((item: any) => (
                <li key={item.id} className="px-4 py-4 hover:bg-gray-50">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {item.errorType && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            {item.errorType}
                          </span>
                        )}
                        {item.resolved ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Resolved
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Unresolved
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {item.occurrenceCount} occurrence
                          {item.occurrenceCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm font-medium text-gray-900">
                      {item.message}
                    </p>

                    {item.url && (
                      <p className="text-xs text-gray-500">
                        URL: {item.url}
                      </p>
                    )}

                    {item.stackTrace && (
                      <details className="mt-2">
                        <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                          View stack trace
                        </summary>
                        <pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                          {item.stackTrace}
                        </pre>
                      </details>
                    )}

                    <div className="text-xs text-gray-500">
                      First seen: {new Date(item.firstSeen).toLocaleString()} •
                      Last seen: {new Date(item.lastSeen).toLocaleString()}
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
