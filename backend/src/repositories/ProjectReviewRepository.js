import pool from '../database/pool.js';

function mapReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    status: row.status,
    triggerSource: row.trigger_source,
    triggerRefId: row.trigger_ref_id,
    situation: row.situation,
    provider: row.provider,
    rawResponse: row.raw_response,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    reviewId: row.review_id,
    fieldKey: row.field_key,
    status: row.status,
    confidence: row.confidence != null ? Number(row.confidence) : null,
    priority: row.priority,
    label: row.label,
    currentValue: row.current_value,
    proposedValue: row.proposed_value,
    rationale: row.rationale,
    payload: row.payload || {},
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const ProjectReviewRepository = {
  async create({ projectId, userId, triggerSource = 'manual', triggerRefId = null }) {
    const { rows } = await pool.query(
      `INSERT INTO project_reviews (project_id, user_id, status, trigger_source, trigger_ref_id)
       VALUES ($1, $2, 'pending', $3, $4)
       RETURNING *`,
      [Number(projectId), Number(userId), triggerSource, triggerRefId]
    );
    return mapReview(rows[0]);
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM project_reviews WHERE id = $1', [
      Number(id),
    ]);
    return mapReview(rows[0]);
  },

  async findLatestForProject(projectId, { statuses = null } = {}) {
    const params = [Number(projectId)];
    let statusClause = '';
    if (Array.isArray(statuses) && statuses.length) {
      params.push(statuses);
      statusClause = ` AND status = ANY($2::text[])`;
    }
    const { rows } = await pool.query(
      `SELECT * FROM project_reviews
       WHERE project_id = $1${statusClause}
       ORDER BY created_at DESC
       LIMIT 1`,
      params
    );
    return mapReview(rows[0]);
  },

  async findActiveForProject(projectId) {
    return this.findLatestForProject(projectId, {
      statuses: ['pending', 'processing', 'ready'],
    });
  },

  async update(id, fields) {
    const sets = [];
    const vals = [Number(id)];
    const map = {
      status: 'status',
      situation: 'situation',
      provider: 'provider',
      rawResponse: 'raw_response',
      errorMessage: 'error_message',
      startedAt: 'started_at',
      finishedAt: 'finished_at',
    };
    for (const [key, col] of Object.entries(map)) {
      if (fields[key] === undefined) continue;
      vals.push(fields[key]);
      sets.push(`${col} = $${vals.length}`);
    }
    if (!sets.length) return this.findById(id);
    sets.push('updated_at = NOW()');
    const { rows } = await pool.query(
      `UPDATE project_reviews SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      vals
    );
    return mapReview(rows[0]);
  },

  async deleteItems(reviewId) {
    await pool.query('DELETE FROM project_review_items WHERE review_id = $1', [
      Number(reviewId),
    ]);
  },

  async createItems(reviewId, items) {
    if (!items?.length) return [];
    const created = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const { rows } = await pool.query(
        `INSERT INTO project_review_items
           (review_id, field_key, status, confidence, priority, label,
            current_value, proposed_value, rationale, payload, sort_order)
         VALUES ($1,$2,'suggested',$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
         RETURNING *`,
        [
          Number(reviewId),
          item.fieldKey,
          item.confidence,
          item.priority || 'medium',
          item.label,
          item.currentValue ?? null,
          item.proposedValue,
          item.rationale ?? null,
          JSON.stringify(item.payload || {}),
          item.sortOrder ?? i,
        ]
      );
      created.push(mapItem(rows[0]));
    }
    return created;
  },

  async listItems(reviewId) {
    const { rows } = await pool.query(
      `SELECT * FROM project_review_items
       WHERE review_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [Number(reviewId)]
    );
    return rows.map(mapItem);
  },

  async findItemsByIds(reviewId, ids) {
    if (!ids?.length) return [];
    const { rows } = await pool.query(
      `SELECT * FROM project_review_items
       WHERE review_id = $1 AND id = ANY($2::int[])`,
      [Number(reviewId), ids.map(Number)]
    );
    return rows.map(mapItem);
  },

  async updateItem(id, fields) {
    const sets = [];
    const vals = [Number(id)];
    const map = {
      status: 'status',
      proposedValue: 'proposed_value',
      rationale: 'rationale',
      payload: 'payload',
    };
    for (const [key, col] of Object.entries(map)) {
      if (fields[key] === undefined) continue;
      vals.push(key === 'payload' ? JSON.stringify(fields[key]) : fields[key]);
      sets.push(`${col} = $${vals.length}${key === 'payload' ? '::jsonb' : ''}`);
    }
    if (!sets.length) return null;
    sets.push('updated_at = NOW()');
    const { rows } = await pool.query(
      `UPDATE project_review_items SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      vals
    );
    return mapItem(rows[0]);
  },
};
