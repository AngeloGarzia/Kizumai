import pool from '../database/pool.js';

const mapConnection = (row) => ({
  id: row.id,
  userId: row.user_id,
  email: row.email,
  action: row.action,
  ipAddress: row.ip_address,
  userAgent: row.user_agent,
  createdAt: row.created_at,
});

export const ConnectionRepository = {
  async create({ userId, email, action, ipAddress, userAgent }) {
    const { rows } = await pool.query(
      `INSERT INTO user_connections (user_id, email, action, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId ?? null, email ?? null, action, ipAddress ?? null, userAgent ?? null]
    );
    return mapConnection(rows[0]);
  },

  async findRecent(limit = 100) {
    const { rows } = await pool.query(
      `SELECT * FROM user_connections
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows.map(mapConnection);
  },
};

