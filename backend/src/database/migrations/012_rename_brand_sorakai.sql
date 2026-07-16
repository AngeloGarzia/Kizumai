UPDATE ai_prompts
SET content = REPLACE(REPLACE(content, 'Myrokay', 'Kizumai'), 'Myrokai', 'Kizumai'),
    updated_at = NOW()
WHERE content LIKE '%Myrokay%' OR content LIKE '%Myrokai%';

UPDATE users
SET email = REPLACE(REPLACE(email, '@myrokay.com', '@kizumai.com'), '@myrokai.com', '@kizumai.com'),
    updated_at = NOW()
WHERE email LIKE '%@myrokay.com' OR email LIKE '%@myrokai.com';
