-- Référentiel des activités (le « quoi » d'un projet).
-- Partagé : plusieurs projets peuvent référencer la même activité.
CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  label VARCHAR(200) NOT NULL,
  sector VARCHAR(80),
  sub_sector VARCHAR(80),
  ape_code VARCHAR(10),
  description TEXT,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unicité insensible à la casse sur le libellé (dé-duplication du référentiel).
CREATE UNIQUE INDEX IF NOT EXISTS idx_activities_label_unique ON activities (lower(label));
CREATE INDEX IF NOT EXISTS idx_activities_sector ON activities (sector);
