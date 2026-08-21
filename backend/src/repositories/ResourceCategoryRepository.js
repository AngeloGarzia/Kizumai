import pool from '../database/pool.js';

export function mapCategory(row) {
  if (!row) return null;
  return {
    id: row.id,
    parentId: row.parent_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    icon: row.icon,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const ResourceCategoryRepository = {
  async listActive() {
    const { rows } = await pool.query(
      `SELECT * FROM resource_categories
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, title ASC`
    );
    return rows.map(mapCategory);
  },

  async findById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM resource_categories WHERE id = $1',
      [Number(id)]
    );
    return mapCategory(rows[0]);
  },

  async findBySlug(slug) {
    const { rows } = await pool.query(
      'SELECT * FROM resource_categories WHERE slug = $1',
      [slug]
    );
    return mapCategory(rows[0]);
  },
};
