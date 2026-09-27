-- Plafonds tokens Fabulous réglables depuis l’admin (0 = illimité pour les budgets journaliers).

INSERT INTO app_settings (key, value) VALUES
  ('ai_daily_token_limit', '0'),
  ('ai_user_daily_token_limit', '0'),
  ('ai_max_output_tokens', '16384')
ON CONFLICT (key) DO NOTHING;
