INSERT INTO ai_prompts (prompt_key, name, role, content) VALUES
  (
    'budget',
    'Prompt Budget',
    'system',
    'Pour le champ « Budget », propose un montant réaliste et cohérent avec le type de projet, le lieu et le marché visé. Le montant doit rester dans la fourchette autorisée, en tenant compte des coûts de lancement (matériel, local, marketing, trésorerie). Réponds en français.'
  )
ON CONFLICT (prompt_key) DO NOTHING;
