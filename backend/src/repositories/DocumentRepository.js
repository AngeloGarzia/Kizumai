import pool from '../database/pool.js';

const DOCUMENT_COLUMNS = `
  d.id, d.project_id, d.uploaded_by, d.category_id, d.type, d.title,
  d.description, d.excerpt, d.file_name, d.storage_key, d.mime_type, d.size_bytes,
  d.attributes, d.created_at, d.updated_at,
  (d.content IS NOT NULL) AS has_content,
  c.slug AS category_slug,
  c.title AS category_title,
  c.parent_id AS category_parent_id
`;

export const mapDocument = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    uploadedBy: row.uploaded_by,
    categoryId: row.category_id ?? null,
    type: row.type,
    title: row.title,
    description: row.description ?? null,
    excerpt: row.excerpt ?? null,
    fileName: row.file_name,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    attributes: row.attributes ?? {},
    hasContent: Boolean(row.has_content),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    category: row.category_slug
      ? {
          id: row.category_id,
          slug: row.category_slug,
          title: row.category_title,
          parentId: row.category_parent_id ?? null,
        }
      : null,
  };
};

export const DocumentRepository = {
  async create({
    projectId,
    uploadedBy,
    type = 'other',
    title,
    fileName,
    storageKey,
    mimeType,
    sizeBytes,
    attributes = {},
    categoryId = null,
    description = null,
    excerpt = null,
    content = null,
  }) {
    const { rows } = await pool.query(
      `INSERT INTO documents
         (project_id, uploaded_by, type, title, file_name, storage_key, mime_type, size_bytes,
          attributes, category_id, description, excerpt, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
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
        categoryId ?? null,
        description,
        excerpt,
        content && Buffer.isBuffer(content) ? content : content,
      ]
    );
    return this.findById(rows[0].id);
  },

  async findByProjectId(projectId) {
    const { rows } = await pool.query(
      `SELECT ${DOCUMENT_COLUMNS}
       FROM documents d
       LEFT JOIN resource_categories c ON c.id = d.category_id
       WHERE d.project_id = $1
       ORDER BY c.sort_order NULLS LAST, d.created_at DESC`,
      [Number(projectId)]
    );
    return rows.map(mapDocument);
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT ${DOCUMENT_COLUMNS}
       FROM documents d
       LEFT JOIN resource_categories c ON c.id = d.category_id
       WHERE d.id = $1`,
      [Number(id)]
    );
    return mapDocument(rows[0]);
  },

  async findContentById(id) {
    const { rows } = await pool.query(
      `SELECT id, content, storage_key, mime_type, file_name, size_bytes
       FROM documents WHERE id = $1`,
      [Number(id)]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      content: row.content ? Buffer.from(row.content) : null,
      storageKey: row.storage_key,
      mimeType: row.mime_type,
      fileName: row.file_name,
      sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    };
  },

  async getProjectQuotaUsage(projectId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count,
              COALESCE(SUM(size_bytes), 0)::bigint AS total_bytes
       FROM documents
       WHERE project_id = $1`,
      [Number(projectId)]
    );
    return {
      count: rows[0]?.count || 0,
      totalBytes: Number(rows[0]?.total_bytes || 0),
    };
  },

  async updateContent(id, content, sizeBytes = null) {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const { rows } = await pool.query(
      `UPDATE documents
       SET content = $2,
           size_bytes = COALESCE($3, size_bytes, octet_length($2)),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [Number(id), buf, sizeBytes]
    );
    return Boolean(rows[0]);
  },

  async update(id, fields) {
    const sets = ['updated_at = NOW()'];
    const params = [Number(id)];
    let i = 2;

    if (fields.title !== undefined) {
      sets.push(`title = $${i++}`);
      params.push(fields.title);
    }
    if (fields.description !== undefined) {
      sets.push(`description = $${i++}`);
      params.push(fields.description);
    }
    if (fields.excerpt !== undefined) {
      sets.push(`excerpt = $${i++}`);
      params.push(fields.excerpt);
    }
    if (fields.categoryId !== undefined) {
      sets.push(`category_id = $${i++}`);
      params.push(fields.categoryId);
    }
    if (fields.attributes !== undefined) {
      sets.push(`attributes = $${i++}`);
      params.push(JSON.stringify(fields.attributes ?? {}));
    }

    const { rows } = await pool.query(
      `UPDATE documents SET ${sets.join(', ')} WHERE id = $1 RETURNING id`,
      params
    );
    return this.findById(rows[0]?.id);
  },

  async delete(id) {
    const { rowCount } = await pool.query('DELETE FROM documents WHERE id = $1', [Number(id)]);
    return rowCount > 0;
  },
};
