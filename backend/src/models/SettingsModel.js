import pool from '../database/pool.js';

export const SettingsModel = {
  async findAll() {
    const { rows } = await pool.query('SELECT * FROM app_settings ORDER BY key ASC');
    return rows;
  },

  async findByKey(key) {
    const { rows } = await pool.query(
      'SELECT * FROM app_settings WHERE key = $1',
      [key]
    );
    return rows[0] ?? null;
  },

  async upsert(key, value) {
    const { rows } = await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
       RETURNING *`,
      [key, value]
    );
    return rows[0];
  },

  async getAsObject() {
    const rows = await this.findAll();
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  },
};
