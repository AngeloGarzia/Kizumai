-- Mémoire synaptique projet pour l'IA API (nœuds + arêtes + snapshots).
-- Extension pgvector pour embeddings (cosine). Sans pgvector, embedding reste NULL.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS project_memory_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  node_type VARCHAR(30) NOT NULL,
  source_entity_type VARCHAR(40),
  source_entity_id INTEGER,
  content TEXT NOT NULL,
  embedding vector(1536),
  importance NUMERIC(4,3) NOT NULL DEFAULT 0.500,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  decay_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0100,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_memory_nodes_type CHECK (
    node_type IN ('fact', 'decision', 'event', 'task_state', 'milestone', 'insight', 'risk')
  ),
  CONSTRAINT chk_memory_nodes_importance CHECK (importance >= 0 AND importance <= 1),
  CONSTRAINT chk_memory_nodes_confidence CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS idx_memory_nodes_project ON project_memory_nodes (project_id);
CREATE INDEX IF NOT EXISTS idx_memory_nodes_project_importance
  ON project_memory_nodes (project_id, importance DESC)
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_memory_nodes_source
  ON project_memory_nodes (project_id, source_entity_type, source_entity_id)
  WHERE source_entity_id IS NOT NULL;

-- Idempotence : un même fait source → un seul nœud actif par type.
CREATE UNIQUE INDEX IF NOT EXISTS uq_memory_nodes_source_type
  ON project_memory_nodes (project_id, source_entity_type, source_entity_id, node_type)
  WHERE source_entity_id IS NOT NULL AND archived_at IS NULL;

-- Index HNSW pour recherche cosine (nécessite pgvector).
CREATE INDEX IF NOT EXISTS idx_memory_nodes_embedding_hnsw
  ON project_memory_nodes
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL AND archived_at IS NULL;

CREATE TABLE IF NOT EXISTS project_memory_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES project_memory_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES project_memory_nodes(id) ON DELETE CASCADE,
  relation_type VARCHAR(30) NOT NULL,
  weight NUMERIC(4,3) NOT NULL DEFAULT 0.500,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_memory_edges_relation CHECK (
    relation_type IN (
      'causes', 'depends_on', 'blocks', 'relates_to',
      'follows', 'contradicts', 'reinforces'
    )
  ),
  CONSTRAINT chk_memory_edges_weight CHECK (weight >= 0 AND weight <= 1),
  CONSTRAINT chk_memory_edges_no_self CHECK (source_node_id <> target_node_id),
  CONSTRAINT uq_memory_edges_pair UNIQUE (source_node_id, target_node_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_memory_edges_project ON project_memory_edges (project_id);
CREATE INDEX IF NOT EXISTS idx_memory_edges_source ON project_memory_edges (source_node_id);
CREATE INDEX IF NOT EXISTS idx_memory_edges_target ON project_memory_edges (target_node_id);

CREATE TABLE IF NOT EXISTS project_memory_snapshots (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  summary TEXT NOT NULL DEFAULT '',
  key_facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_used VARCHAR(80),
  token_count INTEGER,
  events_since_snapshot INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_snapshots_project ON project_memory_snapshots (project_id);

INSERT INTO ai_prompts (prompt_key, name, role, content) VALUES
(
  'memory_snapshot',
  'Mémoire projet — résumé consolidé',
  'system',
  $prompt$Tu consolides la mémoire d'un projet entrepreneurial à partir de souvenirs unitaires.
Produis UNIQUEMENT un JSON valide :
{
  "summary": "résumé narratif court (5-10 phrases)",
  "key_facts": ["fait 1", "fait 2"],
  "active_blockers": ["blocage 1"],
  "next_actions": ["action 1"]
}

Souvenirs (par importance décroissante) :
{{memories}}

Contexte déjà connu (optionnel) :
{{prior_summary}}
$prompt$
),
(
  'memory_recall',
  'Mémoire projet — formatage rappel',
  'system',
  $prompt$Assemble un rappel concis pour une tâche IA. Intent : {{intent}}

Snapshot :
{{snapshot}}

Nœuds pertinents :
{{nodes}}

Réponds en texte structuré court (max 1500 caractères), sans inventer.
$prompt$
)
ON CONFLICT (prompt_key) DO UPDATE
SET name = EXCLUDED.name,
    role = EXCLUDED.role,
    content = EXCLUDED.content,
    updated_at = NOW();
