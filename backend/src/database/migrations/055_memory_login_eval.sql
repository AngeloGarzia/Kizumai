-- Éval contexte mémoire au login (silencieux, projet courant).
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS memory_login_eval_at TIMESTAMPTZ;

INSERT INTO app_settings (key, value) VALUES
  ('memory_login_eval_enabled', 'true'),
  ('memory_login_eval_min_interval_hours', '12')
ON CONFLICT (key) DO NOTHING;
