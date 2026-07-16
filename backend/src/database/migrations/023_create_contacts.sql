-- Contacts : fiche complète (adresse inline) rattachée à un utilisateur et,
-- optionnellement, à un projet principal. Les rattachements « précis » (à un
-- document, une tâche du planner, une société…) passent par la table de
-- liaison POLYMORPHE `contact_links` (1 contact ↔ N objets de types variés).

CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,

  contact_type VARCHAR(20) NOT NULL DEFAULT 'person',
  category VARCHAR(40),

  -- Identité
  civility VARCHAR(10),
  first_name VARCHAR(120),
  last_name VARCHAR(120),
  display_name VARCHAR(200),
  job_title VARCHAR(120),
  organization VARCHAR(200),
  siren VARCHAR(9),
  vat_number VARCHAR(30),
  avatar_url TEXT,

  -- Coordonnées
  email VARCHAR(255),
  phone VARCHAR(40),
  mobile VARCHAR(40),
  website VARCHAR(255),
  emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  phones JSONB NOT NULL DEFAULT '[]'::jsonb,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Adresse (inline)
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  postal_code VARCHAR(16),
  city VARCHAR(120),
  region VARCHAR(120),
  country VARCHAR(2) NOT NULL DEFAULT 'FR',

  -- Divers
  birthday DATE,
  preferred_channel VARCHAR(20),
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  source VARCHAR(30) NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_contacts_type CHECK (contact_type IN ('person', 'company')),
  CONSTRAINT chk_contacts_channel CHECK (
    preferred_channel IS NULL OR preferred_channel IN ('email', 'phone', 'mobile')
  )
);

CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts (user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_project ON contacts (project_id);
CREATE INDEX IF NOT EXISTS idx_contacts_display_name ON contacts (lower(display_name));
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts (email);
CREATE INDEX IF NOT EXISTS idx_contacts_category ON contacts (category);


-- ── Liaison polymorphe : 1 contact rattaché à N objets (projet/document/tâche/société) ──
CREATE TABLE IF NOT EXISTS contact_links (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  entity_type VARCHAR(30) NOT NULL,
  entity_id INTEGER NOT NULL,
  role VARCHAR(80),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_contact_links_entity CHECK (
    entity_type IN ('project', 'document', 'planner_event', 'company')
  ),
  CONSTRAINT uq_contact_links UNIQUE (contact_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_links_contact ON contact_links (contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_links_entity ON contact_links (entity_type, entity_id);


-- ── Intégrité stricte : purge des liaisons quand l'objet cible est supprimé ──
-- La liaison étant polymorphe, aucune FK native n'est possible côté entity_id ;
-- ces triggers garantissent l'absence d'orphelins, y compris lors de
-- suppressions en cascade SQL (ex. suppression d'un projet -> documents/tâches).
CREATE OR REPLACE FUNCTION delete_contact_links_for_entity() RETURNS trigger AS $$
BEGIN
  DELETE FROM contact_links
  WHERE entity_type = TG_ARGV[0] AND entity_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contact_links_project ON projects;
CREATE TRIGGER trg_contact_links_project
  AFTER DELETE ON projects
  FOR EACH ROW EXECUTE FUNCTION delete_contact_links_for_entity('project');

DROP TRIGGER IF EXISTS trg_contact_links_document ON documents;
CREATE TRIGGER trg_contact_links_document
  AFTER DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION delete_contact_links_for_entity('document');

DROP TRIGGER IF EXISTS trg_contact_links_planner_event ON planner_events;
CREATE TRIGGER trg_contact_links_planner_event
  AFTER DELETE ON planner_events
  FOR EACH ROW EXECUTE FUNCTION delete_contact_links_for_entity('planner_event');

DROP TRIGGER IF EXISTS trg_contact_links_company ON companies;
CREATE TRIGGER trg_contact_links_company
  AFTER DELETE ON companies
  FOR EACH ROW EXECUTE FUNCTION delete_contact_links_for_entity('company');
