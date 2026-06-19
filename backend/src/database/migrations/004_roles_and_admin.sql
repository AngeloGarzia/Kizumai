ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_prompts (
  id SERIAL PRIMARY KEY,
  prompt_key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'system',
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_connections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR(255),
  action VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_connections_user_id ON user_connections (user_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_created_at ON user_connections (created_at DESC);

INSERT INTO app_settings (key, value) VALUES
  ('ai_model', 'gpt-4o-mini'),
  ('ai_temperature', '0.7')
ON CONFLICT (key) DO NOTHING;

INSERT INTO ai_prompts (prompt_key, name, role, content) VALUES
  (
    'project_system',
    'Complétion projet — système',
    'system',
    'Tu es un assistant entrepreneurial pour Myrokay. Réponds UNIQUEMENT en JSON valide : {"quoi":"activité ou projet","ou":"lieu ou zone","budget":nombre}. Tout en français. Le budget doit respecter les limites fournies.'
  ),
  (
    'project_user',
    'Complétion projet — utilisateur',
    'user',
    'Projet entrepreneurial Myrokay. Complète uniquement les champs manquants indiqués dans la demande.'
  )
ON CONFLICT (prompt_key) DO NOTHING;
