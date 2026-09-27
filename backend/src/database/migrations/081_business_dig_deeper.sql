-- Fabulous creuse davantage avant de proposer des business (méthode d’exploration).

UPDATE ai_prompts
SET content = regexp_replace(
  content,
  E'CONSIGNE CRÉATIVITÉ \\(obligatoire\\) :\\n\\{\\{creativity_directive\\}\\}',
  E'CONSIGNE CRÉATIVITÉ (obligatoire) :\n{{creativity_directive}}\n\nMÉTHODE — CREUSE LES MÉNINGES (obligatoire) :\n{{dig_deeper_directive}}'
),
updated_at = NOW()
WHERE prompt_key = 'project_user'
  AND content LIKE '%{{creativity_directive}}%'
  AND content NOT LIKE '%{{dig_deeper_directive}}%';
