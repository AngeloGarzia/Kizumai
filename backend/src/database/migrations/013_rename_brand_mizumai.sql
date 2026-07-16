UPDATE ai_prompts
SET content = REPLACE(
  REPLACE(
    REPLACE(content, 'Sorakai', 'Kizumai'),
    'Myrokay', 'Kizumai'
  ),
  'Myrokai', 'Kizumai'
),
    updated_at = NOW()
WHERE content LIKE '%Sorakai%'
   OR content LIKE '%Myrokay%'
   OR content LIKE '%Myrokai%';

UPDATE users
SET email = REPLACE(
  REPLACE(
    REPLACE(email, '@sorakai.com', '@kizumai.com'),
    '@myrokay.com', '@kizumai.com'
  ),
  '@myrokai.com', '@kizumai.com'
),
    updated_at = NOW()
WHERE email LIKE '%@sorakai.com'
   OR email LIKE '%@myrokay.com'
   OR email LIKE '%@myrokai.com';
