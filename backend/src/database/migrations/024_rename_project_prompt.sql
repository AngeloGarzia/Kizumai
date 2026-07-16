UPDATE ai_prompts
SET name = 'Prompt projet',
    updated_at = NOW()
WHERE prompt_key = 'project_user';
