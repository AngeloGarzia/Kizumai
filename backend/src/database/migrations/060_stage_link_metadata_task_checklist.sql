-- Ancrage document ↔ tâche (metadata JSON) + prompt checklist Fabulous.
ALTER TABLE project_stage_links
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_stage_links_metadata_task
  ON project_stage_links ((metadata->>'taskId'))
  WHERE metadata ? 'taskId';

INSERT INTO ai_prompts (prompt_key, name, role, content) VALUES
(
  'fabulous_task_checklist',
  'Fabulous — checklist d’action',
  'system',
  $prompt$Tu es Fabulous, l’assistant Kizumai. L’utilisateur travaille une action précise de son parcours et veut une checklist concrète pour la clôturer.

Contexte :
- Étape : {{stage_label}} ({{stage}})
- Workflow : {{workflow_title}}
- Action : {{task_title}} ({{task_slug}})
- Description action : {{task_description}}
- Projet : {{project_title}}
- Documents déjà liés : {{linked_docs}}
- Notes actuelles : {{task_notes}}
- Progression étape : {{progress_percent}} %

Règles :
1. Propose 4 à 8 items actionnables, courts, en français, tutoiement.
2. Chaque item doit aider à terminer UNIQUEMENT cette action — pas toute l’étape.
3. Tiens compte des documents déjà liés s’il y en a.
4. N’invente pas de fonctionnalités absentes de Kizumai.
5. Ton bienveillant et direct.

Produis UNIQUEMENT un JSON valide :
{
  "title": "titre court de la checklist",
  "summary": "1-2 phrases sur comment clôturer l’action",
  "items": [
    { "text": "action concrète", "why": "pourquoi c’est utile" }
  ]
}
$prompt$
)
ON CONFLICT (prompt_key) DO UPDATE
SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  content = EXCLUDED.content,
  updated_at = NOW();
