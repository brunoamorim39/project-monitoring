-- Projects Table
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  settings TEXT,
  last_health_check INTEGER
);

-- Feedback Table
CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  user_email TEXT,
  user_name TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_feedback_project ON feedback(project_id);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_created ON feedback(created_at DESC);

-- Logs Table
CREATE TABLE logs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  context TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_logs_project ON logs(project_id);
CREATE INDEX idx_logs_level ON logs(level);
CREATE INDEX idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX idx_logs_project_timestamp ON logs(project_id, timestamp DESC);

-- Errors Table
CREATE TABLE errors (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  error_type TEXT,
  url TEXT,
  user_agent TEXT,
  user_context TEXT,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  resolved INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_errors_project ON errors(project_id);
CREATE INDEX idx_errors_resolved ON errors(resolved);
CREATE INDEX idx_errors_last_seen ON errors(last_seen DESC);

-- Health Checks Table
CREATE TABLE health_checks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL,
  response_time INTEGER,
  metadata TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_health_project ON health_checks(project_id);
CREATE INDEX idx_health_timestamp ON health_checks(timestamp DESC);

-- Notes Table
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  note TEXT NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL
);
