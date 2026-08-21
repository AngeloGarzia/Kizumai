-- Étapes de parcours génériques (étude de marché, business plan, …)
-- Héritage : project_stage_runs = instance d'étape ; catalogues séparés des instances.
-- Documents / contacts / events réutilisés via project_stage_links (anti-doublon).

CREATE TABLE IF NOT EXISTS project_stage_runs (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'not_started',
  progress_percent SMALLINT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_stage_runs_stage CHECK (
    stage IN ('idee', 'etude_marche', 'business_plan', 'financement', 'immatriculation', 'lancement')
  ),
  CONSTRAINT chk_stage_runs_status CHECK (
    status IN ('not_started', 'in_progress', 'completed', 'blocked')
  ),
  CONSTRAINT chk_stage_runs_progress CHECK (progress_percent BETWEEN 0 AND 100),
  CONSTRAINT uq_stage_runs_project_stage UNIQUE (project_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_stage_runs_project ON project_stage_runs (project_id);
CREATE INDEX IF NOT EXISTS idx_stage_runs_stage ON project_stage_runs (stage);


CREATE TABLE IF NOT EXISTS stage_workflow_templates (
  id SERIAL PRIMARY KEY,
  stage VARCHAR(30) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_workflow_templates_stage CHECK (
    stage IN ('idee', 'etude_marche', 'business_plan', 'financement', 'immatriculation', 'lancement')
  ),
  CONSTRAINT uq_workflow_templates_stage_slug UNIQUE (stage, slug)
);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_stage ON stage_workflow_templates (stage);


CREATE TABLE IF NOT EXISTS stage_workflow_actions (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES stage_workflow_templates(id) ON DELETE CASCADE,
  slug VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  default_duration_days INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_workflow_actions_template_slug UNIQUE (template_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_workflow_actions_template ON stage_workflow_actions (template_id);


CREATE TABLE IF NOT EXISTS project_stage_tasks (
  id SERIAL PRIMARY KEY,
  stage_run_id INTEGER NOT NULL REFERENCES project_stage_runs(id) ON DELETE CASCADE,
  action_id INTEGER NOT NULL REFERENCES stage_workflow_actions(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'todo',
  notes TEXT,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  planner_event_id INTEGER REFERENCES planner_events(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_stage_tasks_status CHECK (
    status IN ('todo', 'in_progress', 'done', 'skipped')
  ),
  CONSTRAINT uq_stage_tasks_run_action UNIQUE (stage_run_id, action_id)
);

CREATE INDEX IF NOT EXISTS idx_stage_tasks_run ON project_stage_tasks (stage_run_id);
CREATE INDEX IF NOT EXISTS idx_stage_tasks_status ON project_stage_tasks (status);


CREATE TABLE IF NOT EXISTS project_stage_links (
  id SERIAL PRIMARY KEY,
  stage_run_id INTEGER NOT NULL REFERENCES project_stage_runs(id) ON DELETE CASCADE,
  entity_type VARCHAR(30) NOT NULL,
  entity_id INTEGER NOT NULL,
  role VARCHAR(80),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_stage_links_entity CHECK (
    entity_type IN ('document', 'contact', 'planner_event', 'task')
  ),
  CONSTRAINT uq_stage_links UNIQUE (stage_run_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_stage_links_run ON project_stage_links (stage_run_id);
CREATE INDEX IF NOT EXISTS idx_stage_links_entity ON project_stage_links (entity_type, entity_id);


CREATE TABLE IF NOT EXISTS stage_milestone_templates (
  id SERIAL PRIMARY KEY,
  stage VARCHAR(30) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  offset_days INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_milestone_templates_stage CHECK (
    stage IN ('idee', 'etude_marche', 'business_plan', 'financement', 'immatriculation', 'lancement')
  ),
  CONSTRAINT uq_milestone_templates_stage_slug UNIQUE (stage, slug)
);


CREATE TABLE IF NOT EXISTS project_stage_milestones (
  id SERIAL PRIMARY KEY,
  stage_run_id INTEGER NOT NULL REFERENCES project_stage_runs(id) ON DELETE CASCADE,
  slug VARCHAR(80) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  milestone_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'planned',
  task_id INTEGER REFERENCES project_stage_tasks(id) ON DELETE SET NULL,
  planner_event_id INTEGER REFERENCES planner_events(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_stage_milestones_status CHECK (
    status IN ('planned', 'done', 'cancelled')
  ),
  CONSTRAINT uq_stage_milestones_run_slug UNIQUE (stage_run_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_stage_milestones_run ON project_stage_milestones (stage_run_id);
CREATE INDEX IF NOT EXISTS idx_stage_milestones_at ON project_stage_milestones (milestone_at);


-- Purge des liaisons polymorphes stage
CREATE OR REPLACE FUNCTION delete_stage_links_for_entity() RETURNS trigger AS $$
BEGIN
  DELETE FROM project_stage_links
  WHERE entity_type = TG_ARGV[0] AND entity_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stage_links_document ON documents;
CREATE TRIGGER trg_stage_links_document
  AFTER DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION delete_stage_links_for_entity('document');

DROP TRIGGER IF EXISTS trg_stage_links_contact ON contacts;
CREATE TRIGGER trg_stage_links_contact
  AFTER DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION delete_stage_links_for_entity('contact');

DROP TRIGGER IF EXISTS trg_stage_links_planner_event ON planner_events;
CREATE TRIGGER trg_stage_links_planner_event
  AFTER DELETE ON planner_events
  FOR EACH ROW EXECUTE FUNCTION delete_stage_links_for_entity('planner_event');

DROP TRIGGER IF EXISTS trg_stage_links_task ON project_stage_tasks;
CREATE TRIGGER trg_stage_links_task
  AFTER DELETE ON project_stage_tasks
  FOR EACH ROW EXECUTE FUNCTION delete_stage_links_for_entity('task');


-- Étendre contact_links pour rattacher un contact à un stage_run
ALTER TABLE contact_links DROP CONSTRAINT IF EXISTS chk_contact_links_entity;
ALTER TABLE contact_links ADD CONSTRAINT chk_contact_links_entity CHECK (
  entity_type IN ('project', 'document', 'planner_event', 'company', 'project_stage_run', 'project_stage_task')
);

DROP TRIGGER IF EXISTS trg_contact_links_stage_run ON project_stage_runs;
CREATE TRIGGER trg_contact_links_stage_run
  AFTER DELETE ON project_stage_runs
  FOR EACH ROW EXECUTE FUNCTION delete_contact_links_for_entity('project_stage_run');

DROP TRIGGER IF EXISTS trg_contact_links_stage_task ON project_stage_tasks;
CREATE TRIGGER trg_contact_links_stage_task
  AFTER DELETE ON project_stage_tasks
  FOR EACH ROW EXECUTE FUNCTION delete_contact_links_for_entity('project_stage_task');


-- ── Seed catalogue Étude de marché ───────────────────────────────
INSERT INTO stage_workflow_templates (stage, slug, title, description, sort_order, is_required)
VALUES
  ('etude_marche', 'cadrage', 'Cadrage', 'Objectifs, zone géographique et segment de clientèle.', 1, TRUE),
  ('etude_marche', 'clients', 'Clients', 'Personas, interviews et besoins clients.', 2, TRUE),
  ('etude_marche', 'marche', 'Marché', 'Taille, tendances et réglementation du marché.', 3, TRUE),
  ('etude_marche', 'concurrence', 'Concurrence', 'Cartographie concurrentielle, offres et prix.', 4, TRUE),
  ('etude_marche', 'positionnement', 'Positionnement', 'Différenciation et stratégie de prix.', 5, TRUE),
  ('etude_marche', 'synthese', 'Synthèse', 'SWOT, conclusions et décision go / no-go.', 6, TRUE)
ON CONFLICT (stage, slug) DO NOTHING;

INSERT INTO stage_workflow_actions (template_id, slug, title, description, sort_order, is_required, default_duration_days)
SELECT t.id, a.slug, a.title, a.description, a.sort_order, a.is_required, a.default_duration_days
FROM stage_workflow_templates t
JOIN (
  VALUES
    ('cadrage', 'definir-objectifs', 'Définir les objectifs de l''étude', 'Clarifier ce que l''étude doit valider.', 1, TRUE, 3),
    ('cadrage', 'definir-zone', 'Définir la zone géographique', 'Périmètre local / régional / national.', 2, TRUE, 2),
    ('cadrage', 'definir-segment', 'Définir le segment cible', 'Qui sont les clients prioritaires ?', 3, TRUE, 3),
    ('clients', 'creer-personas', 'Créer 2 à 3 personas', 'Profils types de clients.', 1, TRUE, 5),
    ('clients', 'interviews', 'Réaliser au moins 3 interviews', 'Échanger avec des clients potentiels.', 2, TRUE, 14),
    ('clients', 'synthese-besoins', 'Synthétiser les besoins', 'Recenser pains et attentes.', 3, TRUE, 3),
    ('marche', 'estimer-taille', 'Estimer la taille du marché', 'Potentiel local et tendances.', 1, TRUE, 7),
    ('marche', 'reglementation', 'Identifier la réglementation', 'Contraintes légales et normes du secteur.', 2, TRUE, 5),
    ('marche', 'tendances', 'Analyser les tendances', 'Évolutions récentes du marché.', 3, FALSE, 5),
    ('concurrence', 'lister-concurrents', 'Lister 5 concurrents', 'Directs et indirects.', 1, TRUE, 5),
    ('concurrence', 'comparer-offres', 'Comparer offres et prix', 'Tableau concurrentiel.', 2, TRUE, 7),
    ('concurrence', 'forces-faiblesses', 'Noter forces / faiblesses', 'Par concurrent clé.', 3, TRUE, 3),
    ('positionnement', 'avantage', 'Identifier l''avantage différenciant', 'Ce qui vous distingue.', 1, TRUE, 3),
    ('positionnement', 'pricing', 'Valider le positionnement prix', 'Alignement offre / budget client.', 2, TRUE, 5),
    ('synthese', 'swot', 'Rédiger une synthèse SWOT', 'Forces, faiblesses, opportunités, menaces.', 1, TRUE, 5),
    ('synthese', 'go-nogo', 'Décision go / no-go', 'Valider la poursuite du projet.', 2, TRUE, 2)
) AS a(template_slug, slug, title, description, sort_order, is_required, default_duration_days)
  ON t.slug = a.template_slug AND t.stage = 'etude_marche'
ON CONFLICT (template_id, slug) DO NOTHING;

INSERT INTO stage_milestone_templates (stage, slug, title, description, offset_days, sort_order)
VALUES
  ('etude_marche', 'kickoff', 'Lancement de l''étude', 'Démarrage officiel de l''étude de marché.', 0, 1),
  ('etude_marche', 'fin-terrain', 'Fin du terrain', 'Interviews et collecte terminées.', 21, 2),
  ('etude_marche', 'revue-concurrence', 'Revue concurrence', 'Point d''étape sur la cartographie concurrentielle.', 28, 3),
  ('etude_marche', 'rendu-synthese', 'Rendu synthèse', 'Livrable SWOT / conclusions.', 35, 4),
  ('etude_marche', 'validation', 'Validation de l''étude', 'Étude marquée complète.', 42, 5)
ON CONFLICT (stage, slug) DO NOTHING;
