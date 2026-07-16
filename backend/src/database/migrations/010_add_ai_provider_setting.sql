INSERT INTO app_settings (key, value)
VALUES ('ai_provider', 'gemini')
ON CONFLICT (key) DO NOTHING;
