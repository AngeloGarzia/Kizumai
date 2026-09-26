-- Audit expert Fabulous (viabilité / rentabilité) + mémoire des refus liés au contexte projet.

CREATE TABLE IF NOT EXISTS project_audits (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  viability_summary TEXT,
  profitability_summary TEXT,
  overall_verdict TEXT,
  context_fingerprint VARCHAR(64) NOT NULL DEFAULT '',
  provider VARCHAR(40),
  raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_project_audits_status CHECK (
    status IN ('pending', 'processing', 'ready', 'failed', 'dismissed', 'applied')
  )
);

CREATE INDEX IF NOT EXISTS idx_project_audits_project
  ON project_audits (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS project_audit_items (
  id SERIAL PRIMARY KEY,
  audit_id INTEGER NOT NULL REFERENCES project_audits(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL,
  field_key VARCHAR(40),
  action_kind VARCHAR(40),
  status VARCHAR(20) NOT NULL DEFAULT 'suggested',
  priority VARCHAR(10) NOT NULL DEFAULT 'medium',
  confidence NUMERIC(4,3),
  title VARCHAR(255) NOT NULL,
  body TEXT,
  current_value TEXT,
  proposed_value TEXT,
  rationale TEXT,
  proposal_key VARCHAR(80) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_audit_items_type CHECK (item_type IN ('field', 'action')),
  CONSTRAINT chk_audit_items_status CHECK (
    status IN ('suggested', 'accepted', 'rejected')
  ),
  CONSTRAINT chk_audit_items_priority CHECK (
    priority IN ('high', 'medium', 'low')
  )
);

CREATE INDEX IF NOT EXISTS idx_project_audit_items_audit
  ON project_audit_items (audit_id, sort_order, id);

-- Refus mémorisés tant que le contexte projet (fingerprint) n'a pas changé.
CREATE TABLE IF NOT EXISTS project_audit_rejections (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  proposal_key VARCHAR(80) NOT NULL,
  context_fingerprint VARCHAR(64) NOT NULL,
  title VARCHAR(255),
  proposed_value TEXT,
  rejected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_audit_rejection UNIQUE (project_id, proposal_key, context_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_audit_rejections_project
  ON project_audit_rejections (project_id, context_fingerprint);

INSERT INTO ai_prompts (prompt_key, name, role, content) VALUES
(
  'project_audit',
  'Audit expert Fabulous — viabilité & rentabilité',
  'system',
  $prompt$Tu es Fabulous, expert business engagé pour Kizumai (pas un conseiller neutre).
Tu analyses l'ENSEMBLE des données projet fournies. Donne un avis clair et subjectif d'expert
sur la VIABILITÉ et la RENTABILITÉ. Propose des modifications de cadrage ET des alternatives / actions.

RÈGLES :
1) Base-toi uniquement sur le contexte fourni ; indique tes hypothèses si une info manque.
2) Sois franc : si le projet est fragile, dis-le ; si un levier est fort, assume-le.
3) Propose uniquement des changements utiles et actionnables.
4) Ne repropose PAS les idées listées dans « déjà_rejetées » (même contexte).
5) Budget proposé = entier sans devise. Français professionnel.

Projet actuel :
- Titre : {{title}}
- Business : {{business}}
- Lieu : {{location}}
- Budget : {{budget}} {{currency}}
- Étape / statut : {{stage}} / {{status}}
- Description : {{description}}
- Société : {{company}}

Mémoire consolidée :
{{memory_snapshot}}

Documents :
{{documents}}

Échéances / planner :
{{planner}}

Extras :
{{extras}}

Déjà rejetées (ne pas reproposer) :
{{rejected}}

Réponds UNIQUEMENT en JSON valide :
{
  "viabilitySummary": "avis expert viabilité (3-6 phrases)",
  "profitabilitySummary": "avis expert rentabilité (3-6 phrases)",
  "overallVerdict": "verdict global engagé (2-4 phrases)",
  "fieldProposals": [
    {
      "field": "business|location|budget|title|description",
      "currentValue": "valeur actuelle ou null",
      "proposedValue": "nouvelle valeur",
      "rationale": "pourquoi",
      "priority": "high|medium|low",
      "confidence": 0.0
    }
  ],
  "actionProposals": [
    {
      "actionKind": "deadline|document|task|alternative|contact",
      "title": "titre court",
      "body": "quoi faire concrètement",
      "proposedValue": "détail optionnel",
      "rationale": "pourquoi",
      "priority": "high|medium|low",
      "urlHint": "/chemin-optionnel"
    }
  ]
}$prompt$
)
ON CONFLICT (prompt_key) DO UPDATE
SET name = EXCLUDED.name,
    role = EXCLUDED.role,
    content = EXCLUDED.content,
    updated_at = NOW();
