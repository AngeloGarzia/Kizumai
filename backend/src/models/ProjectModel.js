import pool from '../database/pool.js';

const mapProject = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    quoi: row.quoi,
    ou: row.ou,
    budget: row.budget,
    currency: row.currency,
    source: row.source,
    aiPrompt: row.ai_prompt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const ProjectModel = {
  async create({ userId, quoi, ou, budget, currency = 'EUR', source = 'manual', aiPrompt = null }) {
    const { rows } = await pool.query(
      `INSERT INTO projects (user_id, quoi, ou, budget, currency, source, ai_prompt)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId ?? null, quoi, ou, budget, currency, source, aiPrompt]
    );
    return mapProject(rows[0]);
  },

  async findByUserId(userId) {
    const { rows } = await pool.query(
      'SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return rows.map(mapProject);
  },

  async findById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [Number(id)]
    );
    return mapProject(rows[0]);
  },
};
