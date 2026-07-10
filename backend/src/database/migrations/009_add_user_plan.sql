ALTER TABLE users
ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'free'
CHECK (plan IN ('free', 'paid'));

UPDATE users SET plan = 'paid' WHERE role = 'admin';
