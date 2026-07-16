-- Documents rattachés à un projet (Single Table Inheritance).
-- Le discriminant `type` n'est PAS contraint : tout format est autorisé.
-- Les champs propres à chaque type vivent dans `attributes` (JSONB).
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(40) NOT NULL DEFAULT 'other',
  title VARCHAR(200),
  file_name VARCHAR(255) NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type VARCHAR(150),
  size_bytes BIGINT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_project ON documents (project_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents (type);
