import pool from '../database/pool.js';

export const mapLearningRecord = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    documentId: row.document_id,
    recordType: row.record_type,
    title: row.title,
    organization: row.organization,
    status: row.status,
    level: row.level,
    field: row.field,
    format: row.format,
    startDate: row.start_date,
    endDate: row.end_date,
    durationLabel: row.duration_label,
    diplomaObtained: row.diploma_obtained,
    skills: row.skills ?? [],
    description: row.description,
    notes: row.notes,
    source: row.source,
    aiSnapshot: row.ai_snapshot ?? {},
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const UPDATABLE = {
  projectId: 'project_id',
  documentId: 'document_id',
  recordType: 'record_type',
  title: 'title',
  organization: 'organization',
  status: 'status',
  level: 'level',
  field: 'field',
  format: 'format',
  startDate: 'start_date',
  endDate: 'end_date',
  durationLabel: 'duration_label',
  diplomaObtained: 'diploma_obtained',
  description: 'description',
  notes: 'notes',
  // `source` volontairement exclu : défini uniquement à la création côté service.
};

const JSON_FIELDS = {
  skills: 'skills',
  aiSnapshot: 'ai_snapshot',
  metadata: 'metadata',
};

export const LearningRecordRepository = {
  async create(data) {
    const { rows } = await pool.query(
      `INSERT INTO learning_records (
         user_id, project_id, document_id, record_type, title, organization,
         status, level, field, format, start_date, end_date, duration_label,
         diploma_obtained, skills, description, notes, source, ai_snapshot, metadata
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12, $13,
         $14, $15::jsonb, $16, $17, $18, $19::jsonb, $20::jsonb
       )
       RETURNING *`,
      [
        data.userId,
        data.projectId ?? null,
        data.documentId ?? null,
        data.recordType,
        data.title,
        data.organization ?? null,
        data.status || 'envisage',
        data.level ?? null,
        data.field ?? null,
        data.format ?? null,
        data.startDate ?? null,
        data.endDate ?? null,
        data.durationLabel ?? null,
        data.diplomaObtained ?? null,
        JSON.stringify(data.skills || []),
        data.description ?? null,
        data.notes ?? null,
        data.source || 'manual',
        JSON.stringify(data.aiSnapshot || {}),
        JSON.stringify(data.metadata || {}),
      ]
    );
    return mapLearningRecord(rows[0]);
  },

  async findById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM learning_records WHERE id = $1',
      [id]
    );
    return mapLearningRecord(rows[0]);
  },

  async findByUser(userId, { projectId, recordType } = {}) {
    const clauses = ['user_id = $1'];
    const params = [userId];

    if (projectId != null) {
      params.push(projectId);
      clauses.push(`project_id = $${params.length}`);
    }
    if (recordType) {
      params.push(recordType);
      clauses.push(`record_type = $${params.length}`);
    }

    const { rows } = await pool.query(
      `SELECT * FROM learning_records
       WHERE ${clauses.join(' AND ')}
       ORDER BY created_at DESC, id DESC`,
      params
    );
    return rows.map(mapLearningRecord);
  },

  async update(id, fields) {
    const sets = [];
    const params = [];
    let i = 1;

    for (const [key, column] of Object.entries(UPDATABLE)) {
      if (fields[key] !== undefined) {
        sets.push(`${column} = $${i++}`);
        params.push(fields[key]);
      }
    }
    for (const [key, column] of Object.entries(JSON_FIELDS)) {
      if (fields[key] !== undefined) {
        sets.push(`${column} = $${i++}::jsonb`);
        params.push(JSON.stringify(fields[key]));
      }
    }

    if (!sets.length) return this.findById(id);

    sets.push('updated_at = NOW()');
    params.push(id);

    const { rows } = await pool.query(
      `UPDATE learning_records SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    );
    return mapLearningRecord(rows[0]);
  },

  async delete(id) {
    const { rowCount } = await pool.query(
      'DELETE FROM learning_records WHERE id = $1',
      [id]
    );
    return rowCount > 0;
  },
};

