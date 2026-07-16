-- Événements du planificateur (« Planner ») : tâches, échéances, rendez-vous,
-- rappels. Un seul modèle unifié affiché sur le calendrier (semaine/mois/année)
-- et manipulable en glisser-déposer (déplacement = mise à jour start_at/end_at).

CREATE TABLE IF NOT EXISTS planner_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,

  kind VARCHAR(20) NOT NULL DEFAULT 'task',
  title VARCHAR(255) NOT NULL,
  description TEXT,

  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,

  status VARCHAR(20) NOT NULL DEFAULT 'todo',
  location VARCHAR(255),
  color VARCHAR(20),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_planner_kind CHECK (kind IN ('task', 'deadline', 'appointment', 'reminder')),
  CONSTRAINT chk_planner_status CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  CONSTRAINT chk_planner_range CHECK (end_at IS NULL OR end_at >= start_at)
);

CREATE INDEX IF NOT EXISTS idx_planner_events_user ON planner_events (user_id);
CREATE INDEX IF NOT EXISTS idx_planner_events_user_start ON planner_events (user_id, start_at);
CREATE INDEX IF NOT EXISTS idx_planner_events_project ON planner_events (project_id);
