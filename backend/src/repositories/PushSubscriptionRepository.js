import pool from '../database/pool.js';

const mapSubscription = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
    userAgent: row.user_agent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const PushSubscriptionRepository = {
  async findByEndpoint(endpoint) {
    const { rows } = await pool.query(
      'SELECT * FROM push_subscriptions WHERE endpoint = $1',
      [endpoint]
    );
    return mapSubscription(rows[0]);
  },

  async upsert({ userId, endpoint, p256dh, auth, userAgent }) {
    const { rows } = await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint)
       DO UPDATE SET p256dh = EXCLUDED.p256dh,
                     auth = EXCLUDED.auth,
                     user_agent = EXCLUDED.user_agent,
                     updated_at = NOW()
       WHERE push_subscriptions.user_id = EXCLUDED.user_id
       RETURNING *`,
      [userId, endpoint, p256dh, auth, userAgent ?? null]
    );
    return mapSubscription(rows[0]);
  },

  async findByUserId(userId) {
    const { rows } = await pool.query(
      'SELECT * FROM push_subscriptions WHERE user_id = $1',
      [Number(userId)]
    );
    return rows.map(mapSubscription);
  },

  async findAll() {
    const { rows } = await pool.query('SELECT * FROM push_subscriptions');
    return rows.map(mapSubscription);
  },

  async deleteByEndpointForUser(endpoint, userId) {
    const { rowCount } = await pool.query(
      'DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2',
      [endpoint, Number(userId)]
    );
    return rowCount > 0;
  },

  async deleteByEndpoint(endpoint) {
    const { rowCount } = await pool.query(
      'DELETE FROM push_subscriptions WHERE endpoint = $1',
      [endpoint]
    );
    return rowCount > 0;
  },

  async countUsersWithSubscription() {
    const { rows } = await pool.query(
      'SELECT COUNT(DISTINCT user_id)::int AS count FROM push_subscriptions'
    );
    return rows[0]?.count ?? 0;
  },
};
