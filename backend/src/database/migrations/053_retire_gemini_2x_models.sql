-- Retire les modèles Gemini 1.5 / 2.0 / 2.5 refusés aux nouveaux comptes Google.

-- Pro → équivalent 3.1 Pro preview (recommandation Google)
UPDATE app_settings
SET value = 'gemini-3.1-pro-preview',
    updated_at = NOW()
WHERE key = 'ai_model'
  AND value IN (
    'gemini-1.5-pro',
    'gemini-1.5-pro-latest',
    'gemini-2.0-pro',
    'gemini-2.5-pro'
  );

-- Flash / lite / autres 1.5–2.5 → Flash 3.6 stable
UPDATE app_settings
SET value = 'gemini-3.6-flash',
    updated_at = NOW()
WHERE key = 'ai_model'
  AND value ~ '^gemini-(1\.5|2\.0|2\.5)([.-]|$)';
