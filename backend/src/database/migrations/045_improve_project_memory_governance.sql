-- Améliore la gouvernance de la mémoire IA persistante :
-- - distingue les souvenirs permanents / durables / temporaires ;
-- - ajoute un niveau de sensibilité pour éviter la réinjection IA automatique
--   d'informations personnelles ou confidentielles ;
-- - renforce les prompts mémoire sans casser le contrat JSON existant.

ALTER TABLE project_memory_nodes
  ADD COLUMN IF NOT EXISTS memory_kind VARCHAR(20) NOT NULL DEFAULT 'durable',
  ADD COLUMN IF NOT EXISTS sensitivity VARCHAR(20) NOT NULL DEFAULT 'normal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_memory_nodes_kind'
  ) THEN
    ALTER TABLE project_memory_nodes
      ADD CONSTRAINT chk_memory_nodes_kind
      CHECK (memory_kind IN ('permanent', 'durable', 'temporary'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_memory_nodes_sensitivity'
  ) THEN
    ALTER TABLE project_memory_nodes
      ADD CONSTRAINT chk_memory_nodes_sensitivity
      CHECK (sensitivity IN ('normal', 'personal', 'confidential'));
  END IF;
END $$;

UPDATE project_memory_nodes
SET memory_kind = CASE
    WHEN source_entity_type IN ('project', 'company', 'accounting_profile', 'company_officer') THEN 'permanent'
    WHEN node_type IN ('decision', 'milestone') THEN 'durable'
    WHEN node_type IN ('task_state', 'event') THEN 'temporary'
    ELSE 'durable'
  END,
  decay_rate = CASE
    WHEN source_entity_type IN ('project', 'company', 'accounting_profile', 'company_officer') THEN 0
    WHEN node_type IN ('decision', 'milestone') THEN LEAST(decay_rate, 0.002)
    ELSE decay_rate
  END,
  updated_at = NOW()
WHERE memory_kind = 'durable';

CREATE INDEX IF NOT EXISTS idx_memory_nodes_project_kind
  ON project_memory_nodes (project_id, memory_kind, importance DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_memory_nodes_project_sensitivity
  ON project_memory_nodes (project_id, sensitivity)
  WHERE archived_at IS NULL;

UPDATE ai_prompts
SET name = 'Mémoire projet — résumé consolidé sécurisé',
    role = 'system',
    content = $prompt$Tu consolides la mémoire d'un projet entrepreneurial Kizumai à partir de souvenirs unitaires déjà filtrés.
Ta priorité est la fiabilité : n'invente rien, ne transforme pas une hypothèse en fait, et conserve les décisions structurantes.

RÈGLES DE CONSOLIDATION :
1) Sépare clairement faits confirmés, décisions, risques/blocages et prochaines actions.
2) Les souvenirs marqués permanent ou durable sont prioritaires sur les événements temporaires.
3) Si une information contredit le résumé précédent, conserve la version la plus récente ou la plus précise et signale l'incertitude si nécessaire.
4) N'inclus aucune donnée personnelle, financière intime, secret, identifiant, document sensible ou détail inutile à la mission entrepreneuriale.
5) Reste actionnable : le résumé doit aider l'IA à mieux accompagner le porteur sans surcharger le contexte.

Produis UNIQUEMENT un JSON valide :
{
  "summary": "résumé narratif fiable et concis (5-10 phrases)",
  "key_facts": ["fait stable et utile 1", "fait stable et utile 2"],
  "active_blockers": ["blocage ou risque actuel 1"],
  "next_actions": ["action concrète 1"]
}

Souvenirs filtrés par importance décroissante :
{{memories}}

Contexte déjà connu (optionnel) :
{{prior_summary}}
$prompt$,
    updated_at = NOW()
WHERE prompt_key = 'memory_snapshot';

UPDATE ai_prompts
SET name = 'Mémoire projet — rappel sécurisé',
    role = 'system',
    content = $prompt$Tu es l'assistant Kizumai. À partir du snapshot et des souvenirs projet déjà filtrés, rédige un rappel utile pour la tâche demandée.
N'invente rien : utilise uniquement les informations fournies. Si c'est incomplet, dis-le clairement.

RÈGLES DE RAPPEL :
1) Priorise les faits permanents, décisions validées, contraintes actuelles, risques actifs et prochaines actions.
2) Ignore les détails anecdotiques, anciens ou non utiles à l'intention.
3) Ne révèle pas de données personnelles, secrets, informations financières intimes ou identifiants, même si elles apparaissent dans les souvenirs.
4) Si un souvenir est une hypothèse ou une incertitude, garde cette nuance.
5) Le résultat doit aider l'IA à répondre de façon contextualisée, pas refaire tout l'historique.

Intent : {{intent}}

Snapshot :
{{snapshot}}

Souvenirs pertinents :
{{nodes}}

Produis UNIQUEMENT un JSON valide :
{
  "summary": "texte clair en français (8-12 phrases max), structuré mentalement : situation / faits utiles / blocages / suite",
  "key_facts": ["fait utile 1", "fait utile 2"],
  "next_actions": ["action concrète 1", "action 2"]
}
$prompt$,
    updated_at = NOW()
WHERE prompt_key = 'memory_recall';