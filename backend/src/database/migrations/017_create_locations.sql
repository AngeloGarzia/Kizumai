-- Référentiel des lieux (le « où » d'un projet), coordonnées GPS incluses.
-- Partagé : plusieurs projets peuvent référencer le même lieu.
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  label VARCHAR(200) NOT NULL,
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  postal_code VARCHAR(16),
  city VARCHAR(120),
  region VARCHAR(120),
  department VARCHAR(120),
  country VARCHAR(2) NOT NULL DEFAULT 'FR',
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  geo_place_id VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_label_unique ON locations (lower(label));
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations (city);
