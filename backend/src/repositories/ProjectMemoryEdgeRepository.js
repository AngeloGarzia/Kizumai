import pool from '../database/pool.js';
import { mapMemoryNode } from './ProjectMemoryNodeRepository.js';

export function mapMemoryEdge(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    relationType: row.relation_type,
    weight: row.weight != null ? Number(row.weight) : 0.5,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const ProjectMemoryEdgeRepository = {
  async upsertEdge({
    projectId,
    sourceNodeId,
    targetNodeId,
    relationType = 'relates_to',
    weight = 0.5,
    weightBoost = 0.08,
  }) {
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) return null;

    const { rows } = await pool.query(
      `INSERT INTO project_memory_edges
         (project_id, source_node_id, target_node_id, relation_type, weight)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (source_node_id, target_node_id, relation_type)
       DO UPDATE SET
         weight = LEAST(1, project_memory_edges.weight + $6),
         updated_at = NOW()
       RETURNING *`,
      [
        Number(projectId),
        sourceNodeId,
        targetNodeId,
        relationType,
        weight,
        weightBoost,
      ]
    );
    return mapMemoryEdge(rows[0]);
  },

  /**
   * Voisins jusqu'à `depth` sauts (BFS), arêtes sortantes et entrantes.
   */
  async neighbors(nodeIds, { depth = 2, projectId = null } = {}) {
    const seeds = [...new Set((nodeIds || []).filter(Boolean))];
    if (!seeds.length || depth < 1) return { nodes: [], edges: [] };

    const visited = new Set(seeds);
    let frontier = [...seeds];
    const edgeRows = [];

    for (let d = 0; d < depth; d += 1) {
      if (!frontier.length) break;
      const { rows } = await pool.query(
        `SELECT * FROM project_memory_edges
         WHERE (source_node_id = ANY($1::uuid[]) OR target_node_id = ANY($1::uuid[]))
           ${projectId ? 'AND project_id = $2' : ''}`,
        projectId ? [frontier, Number(projectId)] : [frontier]
      );

      const next = [];
      for (const row of rows) {
        edgeRows.push(row);
        for (const nid of [row.source_node_id, row.target_node_id]) {
          if (!visited.has(nid)) {
            visited.add(nid);
            next.push(nid);
          }
        }
      }
      frontier = next;
    }

    const allIds = [...visited];
    const { rows: nodeRows } = await pool.query(
      `SELECT * FROM project_memory_nodes
       WHERE id = ANY($1::uuid[]) AND archived_at IS NULL`,
      [allIds]
    );

    return {
      nodes: nodeRows.map(mapMemoryNode),
      edges: edgeRows.map(mapMemoryEdge),
    };
  },
};
