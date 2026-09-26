import crypto from 'crypto';
import pool from '../database/pool.js';

function mapAudit(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    status: row.status,
    viabilitySummary: row.viability_summary,
    profitabilitySummary: row.profitability_summary,
    overallVerdict: row.overall_verdict,
    contextFingerprint: row.context_fingerprint,
    provider: row.provider,
    rawResponse: row.raw_response ?? {},
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
    auditId: row.audit_id,
    itemType: row.item_type,
    fieldKey: row.field_key,
    actionKind: row.action_kind,
    status: row.status,
    priority: row.priority,
    confidence: row.confidence != null ? Number(row.confidence) : null,
    title: row.title,
    body: row.body,
    currentValue: row.current_value,
    proposedValue: row.proposed_value,
    rationale: row.rationale,
    proposalKey: row.proposal_key,
    payload: row.payload ?? {},
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function hashFingerprint(parts) {
  const raw = (parts || [])
    .map((p) => String(p ?? '').trim().toLowerCase().replace(/\s+/g, ' '))
    .join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 64);
}

export function makeProposalKey({ itemType, fieldKey, actionKind, proposedValue, title }) {
  return hashFingerprint([
    itemType,
    fieldKey || actionKind || '',
    proposedValue || title || '',
  ]).slice(0, 80);
}

export const ProjectAuditRepository = {
  async create({ projectId, userId, contextFingerprint }) {
    const { rows } = await pool.query(
      `INSERT INTO project_audits
         (project_id, user_id, status, context_fingerprint, started_at)
       VALUES ($1, $2, 'processing', $3, NOW())
       RETURNING *`,
      [Number(projectId), Number(userId), contextFingerprint || '']
    );
    return mapAudit(rows[0]);
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM project_audits WHERE id = $1', [
      Number(id),
    ]);
    return mapAudit(rows[0]);
  },

  async findLatestForProject(projectId, { statuses = null } = {}) {
    const params = [Number(projectId)];
    let clause = '';
    if (statuses?.length) {
      params.push(statuses);
      clause = ' AND status = ANY($2::text[])';
    }
    const { rows } = await pool.query(
      `SELECT * FROM project_audits
       WHERE project_id = $1${clause}
       ORDER BY created_at DESC
       LIMIT 1`,
      params
    );
    return mapAudit(rows[0]);
  },

  async update(id, fields) {
    const sets = [];
    const vals = [Number(id)];
    const map = {
      status: 'status',
      viabilitySummary: 'viability_summary',
      profitabilitySummary: 'profitability_summary',
      overallVerdict: 'overall_verdict',
      contextFingerprint: 'context_fingerprint',
      provider: 'provider',
      rawResponse: 'raw_response',
      errorMessage: 'error_message',
      finishedAt: 'finished_at',
    };
    for (const [key, col] of Object.entries(map)) {
      if (fields[key] === undefined) continue;
      vals.push(key === 'rawResponse' ? JSON.stringify(fields[key]) : fields[key]);
      sets.push(`${col} = $${vals.length}${key === 'rawResponse' ? '::jsonb' : ''}`);
    }
    if (!sets.length) return this.findById(id);
    sets.push('updated_at = NOW()');
    const { rows } = await pool.query(
      `UPDATE project_audits SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      vals
    );
    return mapAudit(rows[0]);
  },

  async deleteItems(auditId) {
    await pool.query('DELETE FROM project_audit_items WHERE audit_id = $1', [
      Number(auditId),
    ]);
  },

  async createItems(auditId, items) {
    const created = [];
    for (let i = 0; i < (items || []).length; i += 1) {
      const item = items[i];
      const { rows } = await pool.query(
        `INSERT INTO project_audit_items
           (audit_id, item_type, field_key, action_kind, status, priority, confidence,
            title, body, current_value, proposed_value, rationale, proposal_key, payload, sort_order)
         VALUES ($1,$2,$3,$4,'suggested',$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14)
         RETURNING *`,
        [
          Number(auditId),
          item.itemType,
          item.fieldKey ?? null,
          item.actionKind ?? null,
          item.priority || 'medium',
          item.confidence,
          item.title,
          item.body ?? null,
          item.currentValue ?? null,
          item.proposedValue ?? null,
          item.rationale ?? null,
          item.proposalKey,
          JSON.stringify(item.payload || {}),
          item.sortOrder ?? i,
        ]
      );
      created.push(mapItem(rows[0]));
    }
    return created;
  },

  async listItems(auditId) {
    const { rows } = await pool.query(
      `SELECT * FROM project_audit_items
       WHERE audit_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [Number(auditId)]
    );
    return rows.map(mapItem);
  },

  async findItemsByIds(auditId, ids) {
    if (!ids?.length) return [];
    const { rows } = await pool.query(
      `SELECT * FROM project_audit_items
       WHERE audit_id = $1 AND id = ANY($2::int[])`,
      [Number(auditId), ids.map(Number)]
    );
    return rows.map(mapItem);
  },

  async updateItem(id, fields) {
    const sets = [];
    const vals = [Number(id)];
    const map = {
      status: 'status',
      proposedValue: 'proposed_value',
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
      `UPDATE project_audit_items SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      vals
    );
    return mapItem(rows[0]);
  },

  async listActiveRejections(projectId, contextFingerprint) {
    const { rows } = await pool.query(
      `SELECT proposal_key, title, proposed_value
       FROM project_audit_rejections
       WHERE project_id = $1 AND context_fingerprint = $2`,
      [Number(projectId), contextFingerprint]
    );
    return rows.map((r) => ({
      proposalKey: r.proposal_key,
      title: r.title,
      proposedValue: r.proposed_value,
    }));
  },

  async rememberRejection({
    projectId,
    proposalKey,
    contextFingerprint,
    title,
    proposedValue,
  }) {
    await pool.query(
      `INSERT INTO project_audit_rejections
         (project_id, proposal_key, context_fingerprint, title, proposed_value)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (project_id, proposal_key, context_fingerprint) DO UPDATE SET
         title = EXCLUDED.title,
         proposed_value = EXCLUDED.proposed_value,
         rejected_at = NOW()`,
      [
        Number(projectId),
        proposalKey,
        contextFingerprint,
        title ?? null,
        proposedValue ?? null,
      ]
    );
  },
};
