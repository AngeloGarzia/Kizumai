-- Assistant Fabulous fond de tâche : runs + insights.

CREATE TABLE IF NOT EXISTS project_assistant_runs (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  signals_count INTEGER NOT NULL DEFAULT 0,
  ai_used BOOLEAN NOT NULL DEFAULT FALSE,
  provider VARCHAR(40),
  raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_assistant_runs_status CHECK (
    status IN ('pending', 'processing', 'ready', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_assistant_runs_project
  ON project_assistant_runs (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS project_assistant_insights (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_id INTEGER REFERENCES project_assistant_runs(id) ON DELETE SET NULL,
  kind VARCHAR(40) NOT NULL,
  priority VARCHAR(10) NOT NULL DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  body TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  dedupe_key VARCHAR(180) NOT NULL,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_assistant_insights_kind CHECK (
    kind IN (
      'deadline', 'missing_document', 'stagnation',
      'reflection', 'action', 'reorientation', 'scan_pending'
    )
  ),
  CONSTRAINT chk_assistant_insights_priority CHECK (
    priority IN ('high', 'medium', 'low')
  ),
  CONSTRAINT chk_assistant_insights_status CHECK (
    status IN ('open', 'read', 'dismissed', 'acted')
  ),
  CONSTRAINT uq_assistant_insights_dedupe UNIQUE (project_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_assistant_insights_project_status
  ON project_assistant_insights (project_id, status, priority, created_at DESC);

INSERT INTO app_settings (key, value) VALUES
  ('assistant_enabled', 'true'),
  ('assistant_checkup_cron', '0 */2 * * *'),
  ('assistant_ai_min_interval_hours', '24'),
  ('assistant_stagnation_days', '7'),
  ('assistant_active_within_days', '30')
ON CONFLICT (key) DO NOTHING;

INSERT INTO ai_prompts (prompt_key, name, role, content) VALUES
(
  'project_assistant',
  'Assistant Fabulous — checkup fond de tâche',
  'system',
  $prompt$Tu es Fabulous, assistant entrepreneurial Kizumai.
Tu analyses l'état d'un projet déjà créé. On te donne des SIGNAUX déjà détectés (règles) + le contexte projet.
Ton rôle : produire une réflexion courte et des insights actionnables. N'invente rien.

Projet :
- Titre : {{title}}
- Business : {{business}}
- Lieu : {{location}}
- Budget : {{budget}} {{currency}}
- Étape / statut : {{stage}} / {{status}}
- Description : {{description}}

Mémoire consolidée :
{{memory_snapshot}}

Signaux détectés (règles) :
{{signals}}

Échéances planner :
{{planner}}

Documents / étape :
{{documents}}

Réponds UNIQUEMENT avec un JSON valide :
{
  "reflection": "2 à 5 phrases sur l'état du projet",
  "insights": [
    {
      "kind": "reflection|action|reorientation|deadline|missing_document|stagnation",
      "priority": "high|medium|low",
      "title": "titre court",
      "body": "explication actionnable",
      "urlHint": "/chemin-relatif-optionnel"
    }
  ],
  "reorientationSuggestions": [
    {
      "field": "business|location|budget|title|description",
      "proposedValue": "valeur",
      "rationale": "pourquoi"
    }
  ]
}

Si rien de nouveau utile : insights et reorientationSuggestions peuvent être [].$prompt$
)
ON CONFLICT (prompt_key) DO UPDATE
SET name = EXCLUDED.name,
    role = EXCLUDED.role,
    content = EXCLUDED.content,
    updated_at = NOW();
