import pool from '../database/pool.js';

const mapRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    familyId: row.family_id,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    replacedBy: row.replaced_by,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    userAgent: row.user_agent,
    ip: row.ip,
  };
};

export const RefreshTokenRepository = {
  async create(
    {
      userId,
      tokenHash,
      familyId,
      expiresAt,
      userAgent = null,
      ip = null,
    },
    client = pool
  ) {
    const { rows } = await client.query(
      `INSERT INTO refresh_tokens (
         user_id, token_hash, family_id, expires_at, user_agent, ip
       ) VALUES ($1, $2, $3, $4, $5, $6::inet)
       RETURNING *`,
      [userId, tokenHash, familyId, expiresAt, userAgent, ip]
    );
    return mapRow(rows[0]);
  },

  async findByHashForUpdate(tokenHash, client) {
    const { rows } = await client.query(
      `SELECT * FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
      [tokenHash]
    );
    return mapRow(rows[0]);
  },

  async revoke(id, { replacedBy = null } = {}, client = pool) {
    const { rows } = await client.query(
      `UPDATE refresh_tokens
       SET revoked_at = COALESCE(revoked_at, NOW()),
           replaced_by = COALESCE(replaced_by, $2),
           last_used_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, replacedBy]
    );
    return mapRow(rows[0]);
  },

  async revokeFamily(familyId, client = pool) {
    const { rowCount } = await client.query(
      `UPDATE refresh_tokens
       SET revoked_at = COALESCE(revoked_at, NOW())
       WHERE family_id = $1 AND revoked_at IS NULL`,
      [familyId]
    );
    return rowCount;
  },

  async revokeAllForUser(userId, client = pool) {
    const { rowCount } = await client.query(
      `UPDATE refresh_tokens
       SET revoked_at = COALESCE(revoked_at, NOW())
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
    return rowCount;
  },

  async touch(id, client = pool) {
    await client.query(
      `UPDATE refresh_tokens SET last_used_at = NOW() WHERE id = $1`,
      [id]
    );
  },

  /** Nettoyage opportuniste des tokens expirés / révoqués anciens. */
  async purgeExpired(olderThanDays = 30) {
    const { rowCount } = await pool.query(
      `DELETE FROM refresh_tokens
       WHERE expires_at < NOW() - ($1 * INTERVAL '1 day')
          OR (revoked_at IS NOT NULL AND revoked_at < NOW() - ($1 * INTERVAL '1 day'))`,
      [olderThanDays]
    );
    return rowCount;
  },
};

