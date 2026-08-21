-- Parcours formation / diplôme / études / bilan de compétences.
-- Lié à l'utilisateur (obligatoire) et au projet (optionnel).
-- Pièce jointe : réutilise documents via document_id (nullable).

CREATE TABLE IF NOT EXISTS learning_records (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,

  record_type VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  organization VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'envisage',
  level VARCHAR(80),
  field VARCHAR(120),
  format VARCHAR(30),

  start_date DATE,
  end_date DATE,
  duration_label VARCHAR(80),
  diploma_obtained BOOLEAN,

  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  notes TEXT,

  source VARCHAR(30) NOT NULL DEFAULT 'manual',
  ai_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT learning_records_type_check CHECK (
    record_type IN ('formation', 'diplome', 'etude', 'bilan_competences')
  ),
  CONSTRAINT learning_records_status_check CHECK (
    status IN ('envisage', 'en_cours', 'termine', 'abandonne')
  ),
  CONSTRAINT learning_records_format_check CHECK (
    format IS NULL OR format IN ('en_ligne', 'presentiel', 'mixte')
  ),
  CONSTRAINT learning_records_source_check CHECK (
    source IN ('manual', 'ai_suggestion', 'import')
  ),
  CONSTRAINT learning_records_dates_check CHECK (
    end_date IS NULL OR start_date IS NULL OR end_date >= start_date
  )
);

CREATE INDEX IF NOT EXISTS idx_learning_records_user ON learning_records (user_id);
CREATE INDEX IF NOT EXISTS idx_learning_records_project ON learning_records (project_id);
CREATE INDEX IF NOT EXISTS idx_learning_records_user_type ON learning_records (user_id, record_type);
CREATE INDEX IF NOT EXISTS idx_learning_records_status ON learning_records (status);
