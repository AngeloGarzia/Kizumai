import pool from '../database/pool.js';

const mapUser = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    refreshTokenVersion: row.refresh_token_version,
    role: row.role || 'user',
    plan: row.plan || 'free',
    emailVerifiedAt: row.email_verified_at || null,
    emailVerificationTokenHash: row.email_verification_token_hash || null,
    emailVerificationExpiresAt: row.email_verification_expires_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const UserRepository = {
  async findAll() {
    const { rows } = await pool.query(
      'SELECT * FROM users ORDER BY id ASC'
    );
    return rows.map(mapUser);
  },

  async findById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [Number(id)]
    );
    return mapUser(rows[0]);
  },

  async findByEmail(email) {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    return mapUser(rows[0]);
  },

  async findByEmailVerificationTokenHash(tokenHash) {
    const { rows } = await pool.query(
      `SELECT * FROM users
       WHERE email_verification_token_hash = $1
       LIMIT 1`,
      [tokenHash]
    );
    return mapUser(rows[0]);
  },

  async create({
    name,
    email,
    password,
    role = 'user',
    plan = 'free',
    emailVerifiedAt = null,
    emailVerificationTokenHash = null,
    emailVerificationExpiresAt = null,
  }) {
    const { rows } = await pool.query(
      `INSERT INTO users (
         name, email, password, role, plan,
         email_verified_at, email_verification_token_hash, email_verification_expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        name,
        email.toLowerCase(),
        password,
        role,
        plan,
        emailVerifiedAt,
        emailVerificationTokenHash,
        emailVerificationExpiresAt,
      ]
    );
    return mapUser(rows[0]);
  },

  async setEmailVerificationToken(id, { tokenHash, expiresAt }) {
    const { rows } = await pool.query(
      `UPDATE users
       SET email_verification_token_hash = $2,
           email_verification_expires_at = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [Number(id), tokenHash, expiresAt]
    );
    return mapUser(rows[0]);
  },

  async markEmailVerified(id) {
    const { rows } = await pool.query(
      `UPDATE users
       SET email_verified_at = NOW(),
           email_verification_token_hash = NULL,
           email_verification_expires_at = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [Number(id)]
    );
    return mapUser(rows[0]);
  },

  async updateRole(id, role) {
    const { rows } = await pool.query(
      `UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [Number(id), role]
    );
    return mapUser(rows[0]);
  },

  async updatePlan(id, plan) {
    const { rows } = await pool.query(
      `UPDATE users SET plan = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [Number(id), plan]
    );
    return mapUser(rows[0]);
  },

  async findByRole(role) {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE role = $1 ORDER BY id ASC',
      [role]
    );
    return rows.map(mapUser);
  },

  async update(id, data) {
    const allowedFields = { name: 'name' };
    const entries = Object.entries(data).filter(([key]) => allowedFields[key]);

    if (entries.length === 0) {
      return this.findById(id);
    }

    const setClauses = entries.map(([key], index) => `${allowedFields[key]} = $${index + 2}`);
    const values = entries.map(([, value]) => value);

    const { rows } = await pool.query(
      `UPDATE users
       SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [Number(id), ...values]
    );

    return mapUser(rows[0]);
  },

  async delete(id) {
    const { rowCount } = await pool.query(
      'DELETE FROM users WHERE id = $1',
      [Number(id)]
    );
    return rowCount > 0;
  },

  async incrementRefreshTokenVersion(id) {
    const { rows } = await pool.query(
      `UPDATE users
       SET refresh_token_version = refresh_token_version + 1, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [Number(id)]
    );
    return mapUser(rows[0]);
  },
};
