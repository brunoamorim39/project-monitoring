import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, Form, useNavigation } from "@remix-run/react";
import { useState } from "react";
import Layout from "~/components/Layout";
import { api } from "~/lib/api";

export async function loader() {
  try {
    const response = await api.getProjects();
    return json({ projects: response.data });
  } catch (error: any) {
    return json({ projects: [], error: error.message });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;

  try {
    const response = await api.createProject({ name, slug });
    return json({ success: true, project: response.data });
  } catch (error: any) {
    return json({ success: false, error: error.message });
  }
}

export default function Projects() {
  const { projects, error } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [showForm, setShowForm] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const isSubmitting = navigation.state === "submitting";

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage your monitored projects
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {showForm ? "Cancel" : "New Project"}
          </button>
        </div>

        {/* Create Project Form */}
        {showForm && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Create New Project
            </h3>
            <Form method="post" className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Project Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="My Awesome Project"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Slug (lowercase, alphanumeric with hyphens)
                </label>
                <input
                  type="text"
                  name="slug"
                  required
                  pattern="[a-z0-9-]+"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="my-awesome-project"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isSubmitting ? "Creating..." : "Create Project"}
              </button>
            </Form>
          </div>
        )}

        {/* Projects List */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {error && (
            <div className="px-4 py-3 bg-red-50 border-b border-red-200">
              <p className="text-sm text-red-800">Error: {error}</p>
            </div>
          )}

          {projects.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No projects yet. Create your first project to get started!
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {projects.map((project: any) => (
                <li key={project.id} className="px-4 py-4 hover:bg-gray-50">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {project.name}
                        </p>
                        <p className="text-sm text-gray-500">/{project.slug}</p>
                      </div>
                      <div className="text-xs text-gray-500">
                        Created {new Date(project.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <details className="mt-2">
                      <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                        Show API Key
                      </summary>
                      <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                        <p className="text-xs font-mono text-gray-900 break-all">
                          {project.apiKey}
                        </p>
                        <p className="mt-2 text-xs text-red-600">
                          ⚠️ Keep this key secure! It grants access to submit data to this project.
                        </p>
                      </div>
                    </details>
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
