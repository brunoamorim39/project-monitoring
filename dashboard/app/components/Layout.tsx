import { Link, useLocation } from "@remix-run/react";

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: "Overview", href: "/" },
  { name: "Feedback", href: "/feedback" },
  { name: "Logs", href: "/logs" },
  { name: "Errors", href: "/errors" },
  { name: "Health", href: "/health" },
  { name: "Projects", href: "/projects" },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen" style={{ background: '#0d1117' }}>
      {/* Navigation */}
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold" style={{ color: '#58a6ff' }}>
                  Project Monitor
                </h1>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                      style={{
                        borderColor: isActive ? '#58a6ff' : 'transparent',
                        color: isActive ? '#58a6ff' : '#8b949e',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.color = '#c9d1d9';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.color = '#8b949e';
                        }
                      }}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ color: '#c9d1d9' }}>
        {children}
      </main>
    </div>
  );
}
