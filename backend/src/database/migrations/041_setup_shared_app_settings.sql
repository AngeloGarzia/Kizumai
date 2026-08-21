-- Paramètres applicatifs partagés (Setup admin) — règles métier + mémoire.
INSERT INTO app_settings (key, value) VALUES
  ('budget_eur_min', '500'),
  ('budget_eur_max', '1000000'),
  ('memory_default_decay_rate', '0.01')
ON CONFLICT (key) DO NOTHING;
-- self_serve_paid_enabled : créé via Setup (sinon repli sur ALLOW_SELF_SERVE_PAID / config)
