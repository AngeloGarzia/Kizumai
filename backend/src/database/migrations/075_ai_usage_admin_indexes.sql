-- Index pour agrégats admin tokens IA par projet / utilisateur.

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_project_id
  ON ai_usage_logs (project_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_created
  ON ai_usage_logs (user_id, created_at DESC);
