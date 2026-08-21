import pool from '../database/pool.js';

function parseEmbedding(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value === 'string') {
    try {
      const cleaned = value.replace(/^\[/, '').replace(/\]$/, '');
      if (!cleaned.trim()) return null;
      return cleaned.split(',').map((n) => Number(n.trim()));
    } catch {
      return null;
    }
  }
  return null;
}

function formatEmbedding(embedding) {
  if (!embedding || !Array.isArray(embedding) || embedding.length === 0) return null;
  return `[${embedding.map(Number).join(',')}]`;
}

export function mapMemoryNode(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    nodeType: row.node_type,
    sourceEntityType: row.source_entity_type,
    sourceEntityId: row.source_entity_id,
    content: row.content,
    embedding: parseEmbedding(row.embedding),
    importance: row.importance != null ? Number(row.importance) : 0.5,
    confidence: row.confidence != null ? Number(row.confidence) : 1,
    decayRate: row.decay_rate != null ? Number(row.decay_rate) : 0.01,
    accessCount: row.access_count ?? 0,
    lastAccessedAt: row.last_accessed_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    distance: row.distance != null ? Number(row.distance) : undefined,
  };
}

export const ProjectMemoryNodeRepository = {
  async findById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM project_memory_nodes WHERE id = $1',
      [id]
    );
    return mapMemoryNode(rows[0]);
  },

  async findBySource({ projectId, sourceEntityType, sourceEntityId, nodeType }) {
    const { rows } = await pool.query(
      `SELECT * FROM project_memory_nodes
       WHERE project_id = $1
         AND source_entity_type = $2
         AND source_entity_id = $3
         AND node_type = $4
         AND archived_at IS NULL
       LIMIT 1`,
      [Number(projectId), sourceEntityType, Number(sourceEntityId), nodeType]
    );
    return mapMemoryNode(rows[0]);
  },

  /**
   * Upsert idempotent pour un fait lié à une entité source.
   * Sans source : insert simple.
   */
  async upsertFromSource({
    projectId,
    nodeType,
    content,
    sourceEntityType = null,
    sourceEntityId = null,
    importance = 0.5,
    confidence = 1,
    decayRate = 0.01,
    embedding = null,
  }) {
    const emb = formatEmbedding(embedding);

    if (sourceEntityType && sourceEntityId != null) {
      const { rows } = await pool.query(
        `INSERT INTO project_memory_nodes
           (project_id, node_type, source_entity_type, source_entity_id, content,
            embedding, importance, confidence, decay_rate,
            access_count, last_accessed_at)
         VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8, $9, 1, NOW())
         ON CONFLICT (project_id, source_entity_type, source_entity_id, node_type)
           WHERE source_entity_id IS NOT NULL AND archived_at IS NULL
         DO UPDATE SET
           content = EXCLUDED.content,
           embedding = COALESCE(EXCLUDED.embedding, project_memory_nodes.embedding),
           importance = LEAST(1, GREATEST(project_memory_nodes.importance, EXCLUDED.importance) + 0.05),
           confidence = GREATEST(project_memory_nodes.confidence, EXCLUDED.confidence),
           decay_rate = LEAST(project_memory_nodes.decay_rate, EXCLUDED.decay_rate),
           access_count = project_memory_nodes.access_count + 1,
           last_accessed_at = NOW(),
           updated_at = NOW()
         RETURNING *`,
        [
          Number(projectId),
          nodeType,
          sourceEntityType,
          Number(sourceEntityId),
          content,
          emb,
          importance,
          confidence,
          decayRate,
        ]
      );
      return mapMemoryNode(rows[0]);
    }

    const { rows } = await pool.query(
      `INSERT INTO project_memory_nodes
         (project_id, node_type, content, embedding, importance, confidence, decay_rate,
          access_count, last_accessed_at)
       VALUES ($1, $2, $3, $4::vector, $5, $6, $7, 1, NOW())
       RETURNING *`,
      [Number(projectId), nodeType, content, emb, importance, confidence, decayRate]
    );
    return mapMemoryNode(rows[0]);
  },

  async reinforce(id, { importanceBoost = 0.05 } = {}) {
    const { rows } = await pool.query(
      `UPDATE project_memory_nodes
       SET importance = LEAST(1, importance + $2),
           access_count = access_count + 1,
           last_accessed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND archived_at IS NULL
       RETURNING *`,
      [id, importanceBoost]
    );
    return mapMemoryNode(rows[0]);
  },

  async updateEmbedding(id, embedding) {
    const emb = formatEmbedding(embedding);
    if (!emb) return this.findById(id);
    const { rows } = await pool.query(
      `UPDATE project_memory_nodes
       SET embedding = $2::vector, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, emb]
    );
    return mapMemoryNode(rows[0]);
  },

  async listActiveByImportance(projectId, { limit = 40 } = {}) {
    const { rows } = await pool.query(
      `SELECT * FROM project_memory_nodes
       WHERE project_id = $1 AND archived_at IS NULL
       ORDER BY importance DESC, last_accessed_at DESC NULLS LAST
       LIMIT $2`,
      [Number(projectId), Number(limit)]
    );
    return rows.map(mapMemoryNode);
  },

  async searchByText(projectId, query, { limit = 12 } = {}) {
    const q = String(query || '').trim();
    if (!q) return this.listActiveByImportance(projectId, { limit });
    const { rows } = await pool.query(
      `SELECT * FROM project_memory_nodes
       WHERE project_id = $1
         AND archived_at IS NULL
         AND content ILIKE $2
       ORDER BY importance DESC
       LIMIT $3`,
      [Number(projectId), `%${q}%`, Number(limit)]
    );
    return rows.map(mapMemoryNode);
  },

  async similaritySearch(projectId, embedding, { limit = 12 } = {}) {
    const emb = formatEmbedding(embedding);
    if (!emb) return this.listActiveByImportance(projectId, { limit });
    try {
      const { rows } = await pool.query(
        `SELECT *, (embedding <=> $2::vector) AS distance
         FROM project_memory_nodes
         WHERE project_id = $1
           AND archived_at IS NULL
           AND embedding IS NOT NULL
         ORDER BY embedding <=> $2::vector
         LIMIT $3`,
        [Number(projectId), emb, Number(limit)]
      );
      return rows.map(mapMemoryNode);
    } catch (err) {
      console.warn('[memory] similaritySearch fallback:', err.message);
      return this.listActiveByImportance(projectId, { limit });
    }
  },

  async findByIds(ids = []) {
    if (!ids.length) return [];
    const { rows } = await pool.query(
      `SELECT * FROM project_memory_nodes
       WHERE id = ANY($1::uuid[]) AND archived_at IS NULL`,
      [ids]
    );
    return rows.map(mapMemoryNode);
  },

  /**
   * Applique la décroissance sur tous les nœuds actifs.
   * Formula: importance *= max(0, 1 - decay_rate * hoursSinceAccess / 24)
   */
  async applyDecayBatch() {
    const { rows } = await pool.query(
      `UPDATE project_memory_nodes
       SET importance = GREATEST(
             0,
             importance * GREATEST(
               0,
               1 - decay_rate * (
                 EXTRACT(EPOCH FROM (NOW() - COALESCE(last_accessed_at, created_at))) / 86400.0
               )
             )
           ),
           updated_at = NOW()
       WHERE archived_at IS NULL
       RETURNING id, importance`
    );
    return rows.length;
  },

  async archiveBelowThreshold(threshold = 0.05) {
    const { rows } = await pool.query(
      `UPDATE project_memory_nodes
       SET archived_at = NOW(), updated_at = NOW()
       WHERE archived_at IS NULL AND importance < $1
       RETURNING id`,
      [Number(threshold)]
    );
    return rows.length;
  },
};
