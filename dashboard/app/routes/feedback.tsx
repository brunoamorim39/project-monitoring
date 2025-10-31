import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import Layout from "~/components/Layout";
import { api } from "~/lib/api";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const project = url.searchParams.get("project") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const type = url.searchParams.get("type") || undefined;

  try {
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
          <h2 className="text-2xl font-bold text-gray-900">Feedback</h2>
          <p className="mt-1 text-sm text-gray-500">
            View and manage feedback from all projects
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
              <label className="block text-sm font-medium text-gray-700">
                Type
              </label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {error && (
            <div className="px-4 py-3 bg-red-50 border-b border-red-200">
              <p className="text-sm text-red-800">Error: {error}</p>
            </div>
          )}

          {feedback.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No feedback found
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {feedback.map((item: any) => (
                <li key={item.id} className="px-4 py-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            item.type === "bug"
                              ? "bg-red-100 text-red-800"
                              : item.type === "feature"
                              ? "bg-green-100 text-green-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {item.type}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            item.status === "open"
                              ? "bg-yellow-100 text-yellow-800"
                              : item.status === "in_progress"
                              ? "bg-blue-100 text-blue-800"
                              : item.status === "resolved"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {item.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-gray-900">
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <div className="mt-2 text-xs text-gray-500">
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
