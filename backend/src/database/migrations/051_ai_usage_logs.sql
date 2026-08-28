-- Journalisation des tokens IA par requête.

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  purpose VARCHAR(80),
  provider VARCHAR(40),
  model VARCHAR(120),
  tokens_prompt INTEGER,
  tokens_completion INTEGER,
  tokens_total INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'ok',
  error_message TEXT,
  request_json JSONB,
  response_json JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON ai_usage_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_purpose ON ai_usage_logs (purpose);
