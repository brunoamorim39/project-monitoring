import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, Form, useNavigation } from "@remix-run/react";
import { useState } from "react";
import Layout from "~/components/Layout";
import { createServerAPI } from "~/lib/api";
import { getEnv } from "~/utils/env.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
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
    const response = await api.getProjects();
    return json({ projects: response.data });
  } catch (error: any) {
    return json({ projects: [], error: error.message });
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;

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
            <h2 className="text-2xl font-bold" style={{ color: '#58a6ff' }}>Projects</h2>
            <p className="mt-1 text-sm" style={{ color: '#8b949e' }}>
              Manage your monitored projects
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{ background: '#238636', border: '1px solid #2ea043' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#2ea043'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#238636'}
          >
            {showForm ? "Cancel" : "New Project"}
          </button>
        </div>

        {/* Create Project Form */}
        {showForm && (
          <div className="rounded-lg p-6" style={{ background: '#161b22', border: '1px solid #30363d' }}>
            <h3 className="text-lg font-medium mb-4" style={{ color: '#c9d1d9' }}>
              Create New Project
            </h3>
            <Form method="post" className="space-y-4">
              <div>
                <label className="block text-sm font-medium" style={{ color: '#c9d1d9' }}>
                  Project Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="mt-1 block w-full rounded-md shadow-sm sm:text-sm"
                  style={{ background: '#0d1117', border: '1px solid #30363d', color: '#c9d1d9', padding: '0.5rem' }}
                  placeholder="My Awesome Project"
                />
              </div>
              <div>
                <label className="block text-sm font-medium" style={{ color: '#c9d1d9' }}>
                  Slug (lowercase, alphanumeric with hyphens)
                </label>
                <input
                  type="text"
                  name="slug"
                  required
                  pattern="[a-z0-9\-]+"
                  className="mt-1 block w-full rounded-md shadow-sm sm:text-sm"
                  style={{ background: '#0d1117', border: '1px solid #30363d', color: '#c9d1d9', padding: '0.5rem' }}
                  placeholder="my-awesome-project"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
                style={{ background: '#238636', border: '1px solid #2ea043' }}
                onMouseEnter={(e) => !isSubmitting && (e.currentTarget.style.background = '#2ea043')}
                onMouseLeave={(e) => !isSubmitting && (e.currentTarget.style.background = '#238636')}
              >
                {isSubmitting ? "Creating..." : "Create Project"}
              </button>
            </Form>
          </div>
        )}

        {/* Projects List */}
        <div className="rounded-lg overflow-hidden" style={{ background: '#161b22', border: '1px solid #30363d' }}>
          {error && (
            <div className="px-4 py-3" style={{ background: '#da3633', borderBottom: '1px solid #f85149' }}>
              <p className="text-sm" style={{ color: '#ffd7d5' }}>Error: {error}</p>
            </div>
          )}

          {projects.length === 0 ? (
            <div className="px-4 py-8 text-center" style={{ color: '#8b949e' }}>
              No projects yet. Create your first project to get started!
            </div>
          ) : (
            <ul>
              {projects.map((project: any) => (
                <li
                  key={project.id}
                  className="px-4 py-4"
                  style={{ borderTop: '1px solid #30363d', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#0d1117'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#c9d1d9' }}>
                          {project.name}
                        </p>
                        <p className="text-sm" style={{ color: '#8b949e' }}>/{project.slug}</p>
                      </div>
                      <div className="text-xs" style={{ color: '#8b949e' }}>
                        Created {new Date(project.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer" style={{ color: '#58a6ff' }}>
                        Show API Key
                      </summary>
                      <div className="mt-2 p-3 rounded" style={{ background: '#0d1117', border: '1px solid #30363d' }}>
                        <p className="text-xs font-mono break-all" style={{ color: '#c9d1d9' }}>
                          {project.apiKey}
                        </p>
                        <p className="mt-2 text-xs" style={{ color: '#f85149' }}>
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
