import pool from '../database/pool.js';

const mapRow = (row) => ({
  id: row.id,
  userId: row.user_id,
  projectId: row.project_id,
  purpose: row.purpose,
  provider: row.provider,
  model: row.model,
  tokensPrompt: row.tokens_prompt,
  tokensCompletion: row.tokens_completion,
  tokensTotal: row.tokens_total,
  status: row.status,
  errorMessage: row.error_message,
  requestJson: row.request_json,
  responseJson: row.response_json,
  durationMs: row.duration_ms,
  createdAt: row.created_at,
  userEmail: row.user_email ?? null,
  userName: row.user_name ?? null,
});

function clipJson(value, maxChars = 40_000) {
  if (value == null) return null;
  try {
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    if (raw.length <= maxChars) {
      return typeof value === 'string' ? { raw: value.slice(0, maxChars) } : value;
    }
    return { truncated: true, preview: raw.slice(0, maxChars) };
  } catch {
    return { error: 'unserializable' };
  }
}

export const AiUsageLogRepository = {
  async create({
    userId = null,
    projectId = null,
    purpose = null,
    provider = null,
    model = null,
    tokensPrompt = null,
    tokensCompletion = null,
    tokensTotal = null,
    status = 'ok',
    errorMessage = null,
    requestJson = null,
    responseJson = null,
    durationMs = null,
  }) {
    const { rows } = await pool.query(
      `INSERT INTO ai_usage_logs (
         user_id, project_id, purpose, provider, model,
         tokens_prompt, tokens_completion, tokens_total,
         status, error_message, request_json, response_json, duration_ms
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13)
       RETURNING *`,
      [
        userId != null ? Number(userId) : null,
        projectId != null ? Number(projectId) : null,
        purpose ? String(purpose).slice(0, 80) : null,
        provider ? String(provider).slice(0, 40) : null,
        model ? String(model).slice(0, 120) : null,
        tokensPrompt != null ? Number(tokensPrompt) : null,
        tokensCompletion != null ? Number(tokensCompletion) : null,
        tokensTotal != null ? Number(tokensTotal) : null,
        status || 'ok',
        errorMessage ? String(errorMessage).slice(0, 1000) : null,
        JSON.stringify(clipJson(requestJson)),
        JSON.stringify(clipJson(responseJson)),
        durationMs != null ? Number(durationMs) : null,
      ]
    );
    return mapRow(rows[0]);
  },

  async summarizeByDay({ days = 30 } = {}) {
    const safeDays = Math.min(90, Math.max(1, Number(days) || 30));
    const { rows } = await pool.query(
      `SELECT
         (created_at AT TIME ZONE 'Europe/Paris')::date AS day,
         COUNT(*)::int AS requests,
         COUNT(*) FILTER (WHERE status = 'error')::int AS errors,
         COALESCE(SUM(tokens_prompt), 0)::bigint AS tokens_prompt,
         COALESCE(SUM(tokens_completion), 0)::bigint AS tokens_completion,
         COALESCE(SUM(COALESCE(tokens_total, COALESCE(tokens_prompt,0) + COALESCE(tokens_completion,0))), 0)::bigint AS tokens_total
       FROM ai_usage_logs
       WHERE created_at >= (NOW() AT TIME ZONE 'Europe/Paris')::date - ($1::int - 1) * INTERVAL '1 day'
       GROUP BY 1
       ORDER BY 1 DESC`,
      [safeDays]
    );
    return rows.map((row) => ({
      day: row.day,
      requests: Number(row.requests),
      errors: Number(row.errors),
      tokensPrompt: Number(row.tokens_prompt),
      tokensCompletion: Number(row.tokens_completion),
      tokensTotal: Number(row.tokens_total),
    }));
  },

  async totals({ days = 30 } = {}) {
    const safeDays = Math.min(90, Math.max(1, Number(days) || 30));
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int AS requests,
         COUNT(*) FILTER (WHERE status = 'error')::int AS errors,
         COALESCE(SUM(tokens_prompt), 0)::bigint AS tokens_prompt,
         COALESCE(SUM(tokens_completion), 0)::bigint AS tokens_completion,
         COALESCE(SUM(COALESCE(tokens_total, COALESCE(tokens_prompt,0) + COALESCE(tokens_completion,0))), 0)::bigint AS tokens_total,
         COUNT(*) FILTER (
           WHERE (created_at AT TIME ZONE 'Europe/Paris')::date = (NOW() AT TIME ZONE 'Europe/Paris')::date
         )::int AS requests_today,
         COALESCE(SUM(COALESCE(tokens_total, COALESCE(tokens_prompt,0) + COALESCE(tokens_completion,0))) FILTER (
           WHERE (created_at AT TIME ZONE 'Europe/Paris')::date = (NOW() AT TIME ZONE 'Europe/Paris')::date
         ), 0)::bigint AS tokens_today
       FROM ai_usage_logs
       WHERE created_at >= (NOW() AT TIME ZONE 'Europe/Paris')::date - ($1::int - 1) * INTERVAL '1 day'`,
      [safeDays]
    );
    const row = rows[0] || {};
    return {
      days: safeDays,
      requests: Number(row.requests || 0),
      errors: Number(row.errors || 0),
      tokensPrompt: Number(row.tokens_prompt || 0),
      tokensCompletion: Number(row.tokens_completion || 0),
      tokensTotal: Number(row.tokens_total || 0),
      requestsToday: Number(row.requests_today || 0),
      tokensToday: Number(row.tokens_today || 0),
    };
  },

  async findRecent({ limit = 50, day = null } = {}) {
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
    const params = [safeLimit];
    let dayFilter = '';
    if (day) {
      params.push(String(day));
      dayFilter = `AND (l.created_at AT TIME ZONE 'Europe/Paris')::date = $2::date`;
    }
    const { rows } = await pool.query(
      `SELECT l.*, u.email AS user_email, u.name AS user_name
       FROM ai_usage_logs l
       LEFT JOIN users u ON u.id = l.user_id
       WHERE 1=1 ${dayFilter}
       ORDER BY l.created_at DESC
       LIMIT $1`,
      params
    );
    return rows.map(mapRow);
  },
};
