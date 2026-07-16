-- Renommage résiduel de la marque « Mizumai » vers « Kizumai ».
-- La migration 013 était mal nommée : elle ne traitait que Sorakai/Myrokai.
-- Cette migration corrige les contenus et emails restés en « Mizumai »,
-- de façon idempotente et sans violer la contrainte UNIQUE sur users.email.

UPDATE ai_prompts
SET content = REPLACE(content, 'Mizumai', 'Kizumai'),
    updated_at = NOW()
WHERE content LIKE '%Mizumai%';

-- On ne renomme un email que si la cible n'existe pas déjà,
-- pour éviter toute collision sur la contrainte d'unicité.
UPDATE users AS u
SET email = REPLACE(u.email, '@mizumai.com', '@kizumai.com'),
    updated_at = NOW()
WHERE u.email LIKE '%@mizumai.com'
  AND NOT EXISTS (
    SELECT 1 FROM users AS other
    WHERE other.email = REPLACE(u.email, '@mizumai.com', '@kizumai.com')
  );
