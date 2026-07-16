import pool from '../database/pool.js';

export const mapActivity = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    sector: row.sector,
    subSector: row.sub_sector,
    apeCode: row.ape_code,
    description: row.description,
    keywords: row.keywords ?? [],
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const ActivityModel = {
  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM activities WHERE id = $1', [Number(id)]);
    return mapActivity(rows[0]);
  },

  async findAll() {
    const { rows } = await pool.query('SELECT * FROM activities ORDER BY label ASC');
    return rows.map(mapActivity);
  },

  // Dé-duplication insensible à la casse via l'index unique lower(label).
  async findOrCreate({ label, sector = null, subSector = null, apeCode = null, description = null }) {
    const { rows } = await pool.query(
      `INSERT INTO activities (label, sector, sub_sector, ape_code, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (lower(label)) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [label, sector, subSector, apeCode, description]
    );
    return mapActivity(rows[0]);
  },

  async update(id, { label, sector, subSector, apeCode, description, keywords, metadata }) {
    const { rows } = await pool.query(
      `UPDATE activities
       SET label = COALESCE($2, label),
           sector = COALESCE($3, sector),
           sub_sector = COALESCE($4, sub_sector),
           ape_code = COALESCE($5, ape_code),
           description = COALESCE($6, description),
           keywords = COALESCE($7, keywords),
           metadata = COALESCE($8, metadata),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        Number(id),
        label ?? null,
        sector ?? null,
        subSector ?? null,
        apeCode ?? null,
        description ?? null,
        keywords ? JSON.stringify(keywords) : null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
    return mapActivity(rows[0]);
  },
};
