-- Scan IA des documents : jobs + suggestions (STI item_type + payload).
-- Prompt 100 % en base (ai_prompts.document_scan).

CREATE TABLE IF NOT EXISTS document_scans (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  provider VARCHAR(40),
  prompt_key VARCHAR(100) NOT NULL DEFAULT 'document_scan',
  raw_text_excerpt TEXT,
  raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_document_scans_status CHECK (
    status IN ('pending', 'processing', 'ready', 'failed', 'dismissed')
  )
);

CREATE INDEX IF NOT EXISTS idx_document_scans_document ON document_scans (document_id);
CREATE INDEX IF NOT EXISTS idx_document_scans_project_status ON document_scans (project_id, status);

CREATE TABLE IF NOT EXISTS document_scan_items (
  id SERIAL PRIMARY KEY,
  scan_id INTEGER NOT NULL REFERENCES document_scans(id) ON DELETE CASCADE,
  item_type VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'suggested',
  confidence NUMERIC(4,3),
  label VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  matched_entity_type VARCHAR(30),
  matched_entity_id INTEGER,
  created_entity_type VARCHAR(30),
  created_entity_id INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_scan_items_type CHECK (
    item_type IN ('contact', 'date', 'address', 'organization')
  ),
  CONSTRAINT chk_scan_items_status CHECK (
    status IN ('suggested', 'accepted', 'rejected', 'merged')
  )
);

CREATE INDEX IF NOT EXISTS idx_document_scan_items_scan ON document_scan_items (scan_id);
CREATE INDEX IF NOT EXISTS idx_document_scan_items_status ON document_scan_items (status);

INSERT INTO ai_prompts (prompt_key, name, role, content) VALUES
(
  'document_scan',
  'Scan document — extraction contacts / dates / adresses',
  'system',
  $prompt$Tu analyses le texte extrait d'un document projet entrepreneurial.
N'invente rien : ne propose que ce qui apparaît clairement dans le texte.
Si une information est absente ou ambiguë, omets-la.

Document : {{document_title}}
Type MIME : {{mime_type}}

Texte :
{{text}}

Réponds UNIQUEMENT avec un objet JSON valide de la forme :
{
  "contacts": [
    {
      "displayName": "Nom Prénom ou raison sociale",
      "email": "email ou null",
      "phone": "téléphone ou null",
      "organization": "organisation ou null",
      "jobTitle": "fonction ou null",
      "roleHint": "rôle probable (interviewé, fournisseur, conseil…)",
      "confidence": 0.0,
      "snippet": "courte citation source"
    }
  ],
  "dates": [
    {
      "title": "libellé de l'échéance ou événement",
      "startAt": "ISO-8601 date ou datetime",
      "endAt": "ISO-8601 ou null",
      "allDay": true,
      "kind": "deadline|appointment|task|reminder",
      "confidence": 0.0,
      "snippet": "courte citation source"
    }
  ],
  "addresses": [
    {
      "label": "libellé du lieu",
      "addressLine1": "rue",
      "postalCode": "code postal",
      "city": "ville",
      "country": "FR",
      "confidence": 0.0,
      "snippet": "courte citation source"
    }
  ]
}

Les tableaux peuvent être vides []. Dates en ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ssZ). confidence entre 0 et 1.$prompt$
)
ON CONFLICT (prompt_key) DO UPDATE
SET name = EXCLUDED.name,
    role = EXCLUDED.role,
    content = EXCLUDED.content,
    updated_at = NOW();
