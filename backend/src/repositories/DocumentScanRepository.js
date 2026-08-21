import pool from '../database/pool.js';

function mapScan(row) {
  if (!row) return null;
  return {
    id: row.id,
    documentId: row.document_id,
    projectId: row.project_id,
    userId: row.user_id,
    status: row.status,
    provider: row.provider,
    promptKey: row.prompt_key,
    rawTextExcerpt: row.raw_text_excerpt,
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
    scanId: row.scan_id,
    itemType: row.item_type,
    status: row.status,
    confidence: row.confidence != null ? Number(row.confidence) : null,
    label: row.label,
    payload: row.payload ?? {},
    matchedEntityType: row.matched_entity_type,
    matchedEntityId: row.matched_entity_id,
    createdEntityType: row.created_entity_type,
    createdEntityId: row.created_entity_id,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const DocumentScanRepository = {
  async create({ documentId, projectId, userId, promptKey = 'document_scan' }) {
    const { rows } = await pool.query(
      `INSERT INTO document_scans (document_id, project_id, user_id, status, prompt_key)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING *`,
      [Number(documentId), Number(projectId), Number(userId), promptKey]
    );
    return mapScan(rows[0]);
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM document_scans WHERE id = $1', [Number(id)]);
    return mapScan(rows[0]);
  },

  async findLatestForDocument(documentId) {
    const { rows } = await pool.query(
      `SELECT * FROM document_scans
       WHERE document_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [Number(documentId)]
    );
    return mapScan(rows[0]);
  },

  async listByProjectId(projectId) {
    const { rows } = await pool.query(
      `SELECT * FROM document_scans
       WHERE project_id = $1
       ORDER BY COALESCE(finished_at, created_at) DESC, id DESC`,
      [Number(projectId)]
    );
    return rows.map(mapScan);
  },

  async update(id, fields) {
    const sets = ['updated_at = NOW()'];
    const params = [Number(id)];
    let i = 2;
    const map = {
      status: 'status',
      provider: 'provider',
      rawTextExcerpt: 'raw_text_excerpt',
      rawResponse: 'raw_response',
      errorMessage: 'error_message',
      startedAt: 'started_at',
      finishedAt: 'finished_at',
    };
    for (const [key, col] of Object.entries(map)) {
      if (fields[key] !== undefined) {
        sets.push(`${col} = $${i++}`);
        params.push(
          key === 'rawResponse' ? JSON.stringify(fields[key] ?? {}) : fields[key]
        );
      }
    }
    const { rows } = await pool.query(
      `UPDATE document_scans SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return mapScan(rows[0]);
  },

  async deleteSuggestedItems(scanId) {
    await pool.query(
      `DELETE FROM document_scan_items WHERE scan_id = $1 AND status = 'suggested'`,
      [Number(scanId)]
    );
  },

  async createItems(scanId, items) {
    if (!items.length) return [];
    const values = [];
    const params = [];
    let i = 1;
    let order = 0;
    for (const item of items) {
      values.push(
        `($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}::jsonb, $${i++}, $${i++}, $${i++})`
      );
      params.push(
        Number(scanId),
        item.itemType,
        item.status || 'suggested',
        item.confidence,
        item.label,
        JSON.stringify(item.payload || {}),
        item.matchedEntityType ?? null,
        item.matchedEntityId ?? null,
        order++
      );
    }
    const { rows } = await pool.query(
      `INSERT INTO document_scan_items
         (scan_id, item_type, status, confidence, label, payload,
          matched_entity_type, matched_entity_id, sort_order)
       VALUES ${values.join(', ')}
       RETURNING *`,
      params
    );
    return rows.map(mapItem);
  },

  async listItems(scanId) {
    const { rows } = await pool.query(
      `SELECT * FROM document_scan_items
       WHERE scan_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [Number(scanId)]
    );
    return rows.map(mapItem);
  },

  async findItemsByIds(scanId, ids) {
    if (!ids.length) return [];
    const { rows } = await pool.query(
      `SELECT * FROM document_scan_items
       WHERE scan_id = $1 AND id = ANY($2::int[])`,
      [Number(scanId), ids.map(Number)]
    );
    return rows.map(mapItem);
  },

  async updateItem(id, fields) {
    const sets = ['updated_at = NOW()'];
    const params = [Number(id)];
    let i = 2;
    if (fields.status !== undefined) {
      sets.push(`status = $${i++}`);
      params.push(fields.status);
    }
    if (fields.payload !== undefined) {
      sets.push(`payload = $${i++}`);
      params.push(JSON.stringify(fields.payload));
    }
    if (fields.label !== undefined) {
      sets.push(`label = $${i++}`);
      params.push(fields.label);
    }
    if (fields.createdEntityType !== undefined) {
      sets.push(`created_entity_type = $${i++}`);
      params.push(fields.createdEntityType);
    }
    if (fields.createdEntityId !== undefined) {
      sets.push(`created_entity_id = $${i++}`);
      params.push(fields.createdEntityId);
    }
    const { rows } = await pool.query(
      `UPDATE document_scan_items SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return mapItem(rows[0]);
  },
};
