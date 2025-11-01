interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen" style={{ background: '#0d1117' }}>
      {/* Header */}
      <header style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}>
        <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <h1 className="text-xl font-bold" style={{ color: '#58a6ff' }}>
              Worker Log Viewer
            </h1>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ color: '#c9d1d9' }}>
        {children}
      </main>
    </div>
  );
}
