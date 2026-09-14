-- Confirmation email à l'inscription.
-- Les comptes existants sont considérés comme déjà vérifiés.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;

UPDATE users
SET email_verified_at = COALESCE(email_verified_at, created_at, NOW())
WHERE email_verified_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_verification_token_hash
  ON users (email_verification_token_hash)
  WHERE email_verification_token_hash IS NOT NULL;
