UPDATE app_settings
SET value = 'gemini-3.6-flash', updated_at = NOW()
WHERE "key" = 'ai_model'
  AND value IN ('gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite');