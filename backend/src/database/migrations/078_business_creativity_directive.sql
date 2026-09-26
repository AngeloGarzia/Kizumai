-- La créativité business est pilotée par une consigne métier ({{creativity_directive}}),
-- pas seulement par la température API (peu d'effet en JSON contraint).

UPDATE ai_prompts
SET content = regexp_replace(
  content,
  E'Idée / envie de départ \\(peut être vide\\) : \\{\\{quoi\\}\\}',
  E'CONSIGNE CRÉATIVITÉ (obligatoire) :\n{{creativity_directive}}\n\nIdée / envie de départ (peut être vide) : {{quoi}}'
),
updated_at = NOW()
WHERE prompt_key = 'project_user'
  AND content NOT LIKE '%{{creativity_directive}}%';
