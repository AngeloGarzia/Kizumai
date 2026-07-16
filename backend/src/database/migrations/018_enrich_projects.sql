-- Enrichissement de la table projects : cycle de vie, rapport persisté,
-- et normalisation de quoi/ou vers les référentiels activities/locations.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS title VARCHAR(160),
  ADD COLUMN IF NOT EXISTS activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS legal_form VARCHAR(40),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS stage VARCHAR(30) NOT NULL DEFAULT 'idee',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS report TEXT,
  ADD COLUMN IF NOT EXISTS sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── Reprise des données (backfill) ──
-- 1) Créer les activités à partir des « quoi » existants.
INSERT INTO activities (label)
SELECT DISTINCT quoi
FROM projects
WHERE quoi IS NOT NULL AND btrim(quoi) <> ''
ON CONFLICT (lower(label)) DO NOTHING;

-- 2) Créer les lieux à partir des « ou » existants.
INSERT INTO locations (label)
SELECT DISTINCT ou
FROM projects
WHERE ou IS NOT NULL AND btrim(ou) <> ''
ON CONFLICT (lower(label)) DO NOTHING;

-- 3) Relier les projets aux référentiels.
UPDATE projects p
SET activity_id = a.id
FROM activities a
WHERE lower(a.label) = lower(p.quoi) AND p.activity_id IS NULL;

UPDATE projects p
SET location_id = l.id
FROM locations l
WHERE lower(l.label) = lower(p.ou) AND p.location_id IS NULL;

-- 4) Titre par défaut = ancien « quoi ».
UPDATE projects SET title = quoi WHERE title IS NULL AND quoi IS NOT NULL;

-- 5) Supprimer les colonnes texte désormais normalisées.
ALTER TABLE projects DROP COLUMN IF EXISTS quoi;
ALTER TABLE projects DROP COLUMN IF EXISTS ou;

-- ── Contraintes de cycle de vie ──
ALTER TABLE projects
  ADD CONSTRAINT chk_projects_status
    CHECK (status IN ('draft', 'active', 'paused', 'launched', 'archived')),
  ADD CONSTRAINT chk_projects_stage
    CHECK (stage IN ('idee', 'etude_marche', 'business_plan', 'financement', 'immatriculation', 'lancement'));

CREATE INDEX IF NOT EXISTS idx_projects_user_status ON projects (user_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_activity ON projects (activity_id);
CREATE INDEX IF NOT EXISTS idx_projects_location ON projects (location_id);
