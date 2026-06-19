import pool from '../database/pool.js';

const mapPrompt = (row) => ({
  id: row.id,
  key: row.prompt_key,
  name: row.name,
  role: row.role,
  content: row.content,
  updatedAt: row.updated_at,
});

export const AiPromptModel = {
  async findAll() {
    const { rows } = await pool.query('SELECT * FROM ai_prompts ORDER BY id ASC');
    return rows.map(mapPrompt);
  },

  async findByKey(promptKey) {
    const { rows } = await pool.query(
      'SELECT * FROM ai_prompts WHERE prompt_key = $1',
      [promptKey]
    );
    return mapPrompt(rows[0]);
  },

  async update(promptKey, { name, content, role }) {
    const { rows } = await pool.query(
      `UPDATE ai_prompts
       SET name = COALESCE($2, name),
           content = COALESCE($3, content),
           role = COALESCE($4, role),
           updated_at = NOW()
       WHERE prompt_key = $1
       RETURNING *`,
      [promptKey, name ?? null, content ?? null, role ?? null]
    );
    if (!rows[0]) return null;
    return mapPrompt(rows[0]);
  },
};
