import pool from '../database/pool.js';

export const mapDocument = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    uploadedBy: row.uploaded_by,
    type: row.type,
    title: row.title,
    fileName: row.file_name,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    attributes: row.attributes ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const DocumentModel = {
  async create({ projectId, uploadedBy, type = 'other', title, fileName, storageKey, mimeType, sizeBytes, attributes = {} }) {
    const { rows } = await pool.query(
      `INSERT INTO documents
         (project_id, uploaded_by, type, title, file_name, storage_key, mime_type, size_bytes, attributes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        Number(projectId),
        uploadedBy ?? null,
        type,
        title ?? null,
        fileName,
        storageKey,
        mimeType ?? null,
        sizeBytes ?? null,
        JSON.stringify(attributes),
      ]
    );
    return mapDocument(rows[0]);
  },

  async findByProjectId(projectId) {
    const { rows } = await pool.query(
      'SELECT * FROM documents WHERE project_id = $1 ORDER BY created_at DESC',
      [Number(projectId)]
    );
    return rows.map(mapDocument);
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [Number(id)]);
    return mapDocument(rows[0]);
  },

  async delete(id) {
    const { rowCount } = await pool.query('DELETE FROM documents WHERE id = $1', [Number(id)]);
    return rowCount > 0;
  },
};
