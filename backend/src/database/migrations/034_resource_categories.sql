-- Catégories de ressources (héritage hiérarchique via parent_id).
-- Les documents restent STI (type + attributes) ; la catégorie est une FK catalogue.

CREATE TABLE IF NOT EXISTS resource_categories (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER REFERENCES resource_categories(id) ON DELETE SET NULL,
  slug VARCHAR(80) NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT,
  icon VARCHAR(40),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_resource_categories_slug UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_resource_categories_parent ON resource_categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_resource_categories_sort ON resource_categories (sort_order);

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES resource_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS excerpt TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_category ON documents (category_id);

INSERT INTO resource_categories (slug, title, description, icon, sort_order) VALUES
  ('etude_marche', 'Étude de marché', 'Interviews, concurrence, SWOT, synthèses.', 'chart', 1),
  ('juridique', 'Juridique', 'Statuts, contrats, attestations.', 'scale', 2),
  ('finance', 'Finance', 'Devis, budgets, prêts, factures.', 'wallet', 3),
  ('local', 'Local & immobilier', 'Baux, plans, photos de locaux.', 'building', 4),
  ('formation', 'Formation', 'Diplômes, attestations, bilans.', 'book', 5),
  ('communication', 'Communication', 'Visuels, brochures, médias.', 'megaphone', 6),
  ('autre', 'Autres', 'Documents non classés ailleurs.', 'folder', 99)
ON CONFLICT (slug) DO NOTHING;

-- Sous-catégories (héritage) sous étude de marché
INSERT INTO resource_categories (parent_id, slug, title, description, icon, sort_order)
SELECT p.id, v.slug, v.title, v.description, v.icon, v.sort_order
FROM resource_categories p
CROSS JOIN (VALUES
  ('etude_interviews', 'Interviews clients', 'Comptes-rendus d''entretiens.', 'users', 1),
  ('etude_concurrence', 'Concurrence', 'Tableaux et analyses concurrentielles.', 'grid', 2),
  ('etude_synthese', 'Synthèses', 'SWOT et conclusions.', 'file', 3)
) AS v(slug, title, description, icon, sort_order)
WHERE p.slug = 'etude_marche'
ON CONFLICT (slug) DO NOTHING;
