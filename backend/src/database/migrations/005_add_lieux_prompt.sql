INSERT INTO ai_prompts (prompt_key, name, role, content) VALUES
  (
    'lieux',
    'Prompt Lieux',
    'system',
    'Pour le champ « Où », propose un lieu stratégique pertinent pour le projet : ville, quartier, zone commerciale ou marché géographique adapté. Privilégie des emplacements réalistes, accessibles et cohérents avec le type d''activité et le budget. Réponds en français.'
  )
ON CONFLICT (prompt_key) DO NOTHING;
