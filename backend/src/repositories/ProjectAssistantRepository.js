import pool from '../database/pool.js';

function mapRun(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    signalsCount: row.signals_count ?? 0,
    aiUsed: Boolean(row.ai_used),
    provider: row.provider,
    rawResponse: row.raw_response ?? {},
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInsight(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    runId: row.run_id,
    kind: row.kind,
    priority: row.priority,
    title: row.title,
    body: row.body,
    payload: row.payload ?? {},
    status: row.status,
    dedupeKey: row.dedupe_key,
    notifiedAt: row.notified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const ProjectAssistantRepository = {
  async createRun(projectId) {
    const { rows } = await pool.query(
      `INSERT INTO project_assistant_runs (project_id, status, started_at)
       VALUES ($1, 'processing', NOW())
       RETURNING *`,
      [Number(projectId)]
    );
    return mapRun(rows[0]);
  },

  async updateRun(id, fields) {
    const sets = [];
    const vals = [Number(id)];
    const map = {
      status: 'status',
      signalsCount: 'signals_count',
      aiUsed: 'ai_used',
      provider: 'provider',
      rawResponse: 'raw_response',
      errorMessage: 'error_message',
      finishedAt: 'finished_at',
    };
    for (const [key, col] of Object.entries(map)) {
      if (fields[key] === undefined) continue;
      vals.push(key === 'rawResponse' ? JSON.stringify(fields[key]) : fields[key]);
      sets.push(
        `${col} = $${vals.length}${key === 'rawResponse' ? '::jsonb' : ''}`
      );
    }
    if (!sets.length) return this.findRunById(id);
    sets.push('updated_at = NOW()');
    const { rows } = await pool.query(
      `UPDATE project_assistant_runs SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      vals
    );
    return mapRun(rows[0]);
  },

  async findRunById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM project_assistant_runs WHERE id = $1',
      [Number(id)]
    );
    return mapRun(rows[0]);
  },

  async findLatestAiRun(projectId) {
    const { rows } = await pool.query(
      `SELECT * FROM project_assistant_runs
       WHERE project_id = $1 AND ai_used = TRUE AND status = 'ready'
       ORDER BY finished_at DESC NULLS LAST
       LIMIT 1`,
      [Number(projectId)]
    );
    return mapRun(rows[0]);
  },

  async findLatestRun(projectId) {
    const { rows } = await pool.query(
      `SELECT * FROM project_assistant_runs
       WHERE project_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [Number(projectId)]
    );
    return mapRun(rows[0]);
  },

  async hasProcessingRun(projectId) {
    const { rows } = await pool.query(
      `SELECT 1 FROM project_assistant_runs
       WHERE project_id = $1 AND status = 'processing'
         AND started_at > NOW() - INTERVAL '30 minutes'
       LIMIT 1`,
      [Number(projectId)]
    );
    return Boolean(rows[0]);
  },

  async upsertInsight({
    projectId,
    runId = null,
    kind,
    priority = 'medium',
    title,
    body = null,
    payload = {},
    dedupeKey,
  }) {
    const { rows } = await pool.query(
      `INSERT INTO project_assistant_insights
         (project_id, run_id, kind, priority, title, body, payload, dedupe_key, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'open')
       ON CONFLICT (project_id, dedupe_key) DO UPDATE SET
         run_id = COALESCE(EXCLUDED.run_id, project_assistant_insights.run_id),
         priority = EXCLUDED.priority,
         title = EXCLUDED.title,
         body = EXCLUDED.body,
         payload = EXCLUDED.payload,
         status = CASE
           WHEN project_assistant_insights.status IN ('dismissed', 'acted')
             THEN project_assistant_insights.status
           ELSE 'open'
         END,
         updated_at = NOW()
       RETURNING *`,
      [
        Number(projectId),
        runId == null ? null : Number(runId),
        kind,
        priority,
        title,
        body,
        JSON.stringify(payload || {}),
        String(dedupeKey).slice(0, 180),
      ]
    );
    return mapInsight(rows[0]);
  },

  async listOpenByProject(projectId, { limit = 40 } = {}) {
    const { rows } = await pool.query(
      `SELECT * FROM project_assistant_insights
       WHERE project_id = $1 AND status IN ('open', 'read')
       ORDER BY
         CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
         created_at DESC
       LIMIT $2`,
      [Number(projectId), Number(limit)]
    );
    return rows.map(mapInsight);
  },

  async countOpenByProject(projectId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM project_assistant_insights
       WHERE project_id = $1 AND status = 'open'`,
      [Number(projectId)]
    );
    return rows[0]?.n || 0;
  },

  async findInsight(projectId, insightId) {
    const { rows } = await pool.query(
      `SELECT * FROM project_assistant_insights
       WHERE id = $1 AND project_id = $2`,
      [Number(insightId), Number(projectId)]
    );
    return mapInsight(rows[0]);
  },

  async updateInsightStatus(id, status) {
    const { rows } = await pool.query(
      `UPDATE project_assistant_insights
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [Number(id), status]
    );
    return mapInsight(rows[0]);
  },

  async markNotified(ids) {
    if (!ids?.length) return;
    await pool.query(
      `UPDATE project_assistant_insights
       SET notified_at = NOW(), updated_at = NOW()
       WHERE id = ANY($1::int[]) AND notified_at IS NULL`,
      [ids.map(Number)]
    );
  },

  async listEligibleProjectIds({ withinDays = 30 } = {}) {
    const { rows } = await pool.query(
      `SELECT id FROM projects
       WHERE status IN ('draft', 'active', 'paused')
         AND updated_at > NOW() - make_interval(days => $1)
       ORDER BY updated_at DESC
       LIMIT 500`,
      [Math.max(1, Number(withinDays) || 30)]
    );
    return rows.map((r) => r.id);
  },
};
