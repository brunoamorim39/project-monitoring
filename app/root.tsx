import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/cloudflare";
import stylesheet from "~/tailwind.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body style={{ background: '#0d1117', color: '#c9d1d9', margin: 0, padding: 0 }}>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Error</title>
        <Links />
      </head>
      <body style={{ background: '#0d1117', color: '#c9d1d9', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ color: '#f85149', marginBottom: '1rem' }}>
            {isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : 'Application Error'}
          </h1>
          <div style={{ background: '#161b22', padding: '1rem', borderRadius: '6px', border: '1px solid #30363d' }}>
            <p style={{ color: '#8b949e', margin: 0 }}>
              {isRouteErrorResponse(error)
                ? error.data?.message || 'An error occurred'
                : error instanceof Error
                ? error.message
                : 'An unexpected error occurred'}
            </p>
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
