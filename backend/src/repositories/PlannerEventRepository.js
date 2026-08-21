import pool from '../database/pool.js';

export const mapEvent = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    startAt: row.start_at,
    endAt: row.end_at,
    allDay: row.all_day,
    status: row.status,
    location: row.location,
    color: row.color,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const UPDATABLE = {
  projectId: 'project_id',
  kind: 'kind',
  title: 'title',
  description: 'description',
  startAt: 'start_at',
  endAt: 'end_at',
  allDay: 'all_day',
  status: 'status',
  location: 'location',
  color: 'color',
};

export const PlannerEventRepository = {
  async create({
    userId,
    projectId = null,
    kind = 'task',
    title,
    description = null,
    startAt,
    endAt = null,
    allDay = false,
    status = 'todo',
    location = null,
    color = null,
    metadata = {},
  }) {
    const { rows } = await pool.query(
      `INSERT INTO planner_events
         (user_id, project_id, kind, title, description, start_at, end_at, all_day, status, location, color, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        userId,
        projectId,
        kind,
        title,
        description,
        startAt,
        endAt,
        allDay,
        status,
        location,
        color,
        JSON.stringify(metadata),
      ]
    );
    return mapEvent(rows[0]);
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM planner_events WHERE id = $1', [Number(id)]);
    return mapEvent(rows[0]);
  },

  // Événements d'un utilisateur qui chevauchent la fenêtre [from, to].
  async findByUserInRange(userId, from, to) {
    const clauses = ['user_id = $1'];
    const values = [Number(userId)];

    if (from) {
      values.push(from);
      clauses.push(`(end_at IS NULL OR end_at >= $${values.length})`);
    }
    if (to) {
      values.push(to);
      clauses.push(`start_at <= $${values.length}`);
    }

    const { rows } = await pool.query(
      `SELECT * FROM planner_events WHERE ${clauses.join(' AND ')} ORDER BY start_at ASC`,
      values
    );
    return rows.map(mapEvent);
  },

  async findByProjectId(projectId) {
    const { rows } = await pool.query(
      `SELECT * FROM planner_events
       WHERE project_id = $1
       ORDER BY start_at ASC NULLS LAST, id ASC`,
      [Number(projectId)]
    );
    return rows.map(mapEvent);
  },

  async update(id, data = {}) {
    const setClauses = [];
    const values = [Number(id)];
    let i = 2;

    for (const [key, col] of Object.entries(UPDATABLE)) {
      if (data[key] !== undefined) {
        setClauses.push(`${col} = $${i}`);
        values.push(data[key]);
        i += 1;
      }
    }

    if (data.metadata !== undefined) {
      setClauses.push(`metadata = $${i}`);
      values.push(JSON.stringify(data.metadata));
      i += 1;
    }

    if (setClauses.length === 0) return this.findById(id);

    const { rows } = await pool.query(
      `UPDATE planner_events SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      values
    );
    return mapEvent(rows[0]);
  },

  async delete(id) {
    const { rowCount } = await pool.query('DELETE FROM planner_events WHERE id = $1', [Number(id)]);
    return rowCount > 0;
  },
};

