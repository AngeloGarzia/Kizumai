UPDATE ai_prompts
SET content = REPLACE(content, 'Myrokay', 'Myrokai'),
    updated_at = NOW()
WHERE content LIKE '%Myrokay%';
