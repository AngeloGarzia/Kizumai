import pool from '../database/pool.js';

export function mapMemorySnapshot(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    summary: row.summary || '',
    keyFacts: row.key_facts ?? [],
    activeBlockers: row.active_blockers ?? [],
    nextActions: row.next_actions ?? [],
    generatedAt: row.generated_at,
    modelUsed: row.model_used,
    tokenCount: row.token_count,
    eventsSinceSnapshot: row.events_since_snapshot ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const ProjectMemorySnapshotRepository = {
  async findByProjectId(projectId) {
    const { rows } = await pool.query(
      'SELECT * FROM project_memory_snapshots WHERE project_id = $1',
      [Number(projectId)]
    );
    return mapMemorySnapshot(rows[0]);
  },

  async upsertForProject({
    projectId,
    summary,
    keyFacts = [],
    activeBlockers = [],
    nextActions = [],
    modelUsed = null,
    tokenCount = null,
  }) {
    const { rows } = await pool.query(
      `INSERT INTO project_memory_snapshots
         (project_id, summary, key_facts, active_blockers, next_actions,
          generated_at, model_used, token_count, events_since_snapshot)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, NOW(), $6, $7, 0)
       ON CONFLICT (project_id) DO UPDATE SET
         summary = EXCLUDED.summary,
         key_facts = EXCLUDED.key_facts,
         active_blockers = EXCLUDED.active_blockers,
         next_actions = EXCLUDED.next_actions,
         generated_at = NOW(),
         model_used = EXCLUDED.model_used,
         token_count = EXCLUDED.token_count,
         events_since_snapshot = 0,
         updated_at = NOW()
       RETURNING *`,
      [
        Number(projectId),
        summary || '',
        JSON.stringify(keyFacts),
        JSON.stringify(activeBlockers),
        JSON.stringify(nextActions),
        modelUsed,
        tokenCount,
      ]
    );
    return mapMemorySnapshot(rows[0]);
  },

  async incrementEvents(projectId, by = 1) {
    const { rows } = await pool.query(
      `INSERT INTO project_memory_snapshots (project_id, summary, events_since_snapshot)
       VALUES ($1, '', $2)
       ON CONFLICT (project_id) DO UPDATE SET
         events_since_snapshot = project_memory_snapshots.events_since_snapshot + $2,
         updated_at = NOW()
       RETURNING *`,
      [Number(projectId), Number(by)]
    );
    return mapMemorySnapshot(rows[0]);
  },

  async listProjectsNeedingSnapshot({ eventThreshold = 8, maxAgeHours = 24 } = {}) {
    const { rows } = await pool.query(
      `SELECT s.* FROM project_memory_snapshots s
       WHERE s.events_since_snapshot >= $1
          OR s.generated_at < NOW() - ($2 || ' hours')::interval
       ORDER BY s.events_since_snapshot DESC
       LIMIT 50`,
      [Number(eventThreshold), String(maxAgeHours)]
    );
    return rows.map(mapMemorySnapshot);
  },

  async listProjectIdsWithActiveNodes() {
    const { rows } = await pool.query(
      `SELECT DISTINCT project_id FROM project_memory_nodes
       WHERE archived_at IS NULL
       ORDER BY project_id`
    );
    return rows.map((r) => r.project_id);
  },
};
