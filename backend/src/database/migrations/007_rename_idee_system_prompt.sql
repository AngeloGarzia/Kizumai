UPDATE ai_prompts
SET prompt_key = 'idee_system',
    name = 'Prompt Idée',
    role = 'system',
    updated_at = NOW()
WHERE prompt_key = 'project_system';

INSERT INTO ai_prompts (prompt_key, name, role, content)
SELECT
  'idee_system',
  'Prompt Idée',
  'system',
  'Tu es un assistant entrepreneurial pour Kizumai. Réponds UNIQUEMENT en JSON valide : {"quoi":"activité ou projet","ou":"lieu ou zone","budget":nombre}. Tout en français. Le budget doit respecter les limites fournies.'
WHERE NOT EXISTS (SELECT 1 FROM ai_prompts WHERE prompt_key = 'idee_system');
