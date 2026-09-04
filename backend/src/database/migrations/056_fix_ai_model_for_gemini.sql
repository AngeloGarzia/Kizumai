-- Migration 004 insérait gpt-4o-mini alors que le provider par défaut est Gemini (010).
UPDATE app_settings
SET value = 'gemini-3.6-flash', updated_at = NOW()
WHERE key = 'ai_model'
  AND value = 'gpt-4o-mini';
