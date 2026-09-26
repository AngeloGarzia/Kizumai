-- Réorientation projet : analyse IA de l'état global + propositions à valider.

CREATE TABLE IF NOT EXISTS project_reviews (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  trigger_source VARCHAR(40) NOT NULL DEFAULT 'manual',
  trigger_ref_id INTEGER,
  situation TEXT,
  provider VARCHAR(40),
  raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_project_reviews_status CHECK (
    status IN ('pending', 'processing', 'ready', 'failed', 'dismissed', 'applied')
  )
);

CREATE INDEX IF NOT EXISTS idx_project_reviews_project_status
  ON project_reviews (project_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS project_review_items (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES project_reviews(id) ON DELETE CASCADE,
  field_key VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'suggested',
  confidence NUMERIC(4,3),
  priority VARCHAR(10) NOT NULL DEFAULT 'medium',
  label VARCHAR(255) NOT NULL,
  current_value TEXT,
  proposed_value TEXT NOT NULL,
  rationale TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_review_items_field CHECK (
    field_key IN ('business', 'location', 'budget', 'title', 'description')
  ),
  CONSTRAINT chk_review_items_status CHECK (
    status IN ('suggested', 'accepted', 'rejected')
  ),
  CONSTRAINT chk_review_items_priority CHECK (
    priority IN ('high', 'medium', 'low')
  )
);

CREATE INDEX IF NOT EXISTS idx_project_review_items_review
  ON project_review_items (review_id);

INSERT INTO ai_prompts (prompt_key, name, role, content) VALUES
(
  'project_reorientation',
  'Réorientation projet — analyse état + propositions',
  'system',
  $prompt$Tu es Fabulous, analyste entrepreneurial pour Kizumai.
Tu reçois l'état COMPLET d'un projet déjà créé, mis à jour avec de nouvelles données (documents, contacts, mémoire, etc.).
Ton rôle : analyser si le business, le lieu, le budget, le titre ou la description doivent être réorientés.

RÈGLES :
1) N'invente pas de faits absents du contexte.
2) Ne propose un changement QUE s'il est clairement justifié par les nouvelles données.
3) Si l'état actuel reste cohérent, renvoie proposals: [].
4) Les propositions doivent être actionnables (valeurs concrètes, pas de conseils vagues).
5) Budget toujours en nombre entier (sans devise dans proposedValue).
6) Français clair et professionnel.

État projet actuel :
- Titre : {{title}}
- Business (activité) : {{business}}
- Lieu : {{location}}
- Budget : {{budget}} {{currency}}
- Statut / étape : {{status}} / {{stage}}
- Description : {{description}}
- Société liée : {{company}}

Mémoire projet consolidée :
{{memory_snapshot}}

Documents récents (résumés / titres) :
{{documents}}

Autres faits utiles :
{{extras}}

Déclencheur de cette analyse : {{trigger}}

Réponds UNIQUEMENT avec un JSON valide :
{
  "situation": "synthèse de l'état du projet en 3 à 6 phrases",
  "proposals": [
    {
      "field": "business|location|budget|title|description",
      "currentValue": "valeur actuelle ou null",
      "proposedValue": "nouvelle valeur proposée",
      "rationale": "pourquoi ce changement, lié aux données",
      "confidence": 0.0,
      "priority": "high|medium|low"
    }
  ]
}$prompt$
)
ON CONFLICT (prompt_key) DO UPDATE
SET name = EXCLUDED.name,
    role = EXCLUDED.role,
    content = EXCLUDED.content,
    updated_at = NOW();
