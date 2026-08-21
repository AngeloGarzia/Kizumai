import pool from '../database/pool.js';

function mapRun(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    stage: row.stage,
    status: row.status,
    progressPercent: row.progress_percent,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    summary: row.summary,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    stage: row.stage,
    slug: row.slug,
    title: row.title,
    description: row.description,
    sortOrder: row.sort_order,
    isRequired: row.is_required,
    isActive: row.is_active,
  };
}

function mapAction(row) {
  if (!row) return null;
  return {
    id: row.id,
    templateId: row.template_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    sortOrder: row.sort_order,
    isRequired: row.is_required,
    defaultDurationDays: row.default_duration_days,
    isActive: row.is_active,
    templateSlug: row.template_slug ?? undefined,
    templateTitle: row.template_title ?? undefined,
  };
}

function mapTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    stageRunId: row.stage_run_id,
    actionId: row.action_id,
    status: row.status,
    notes: row.notes,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    plannerEventId: row.planner_event_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    action: row.action_title
      ? {
          id: row.action_id,
          slug: row.action_slug,
          title: row.action_title,
          description: row.action_description,
          isRequired: row.action_is_required,
          sortOrder: row.action_sort_order,
          templateSlug: row.template_slug,
          templateTitle: row.template_title,
          templateSortOrder: row.template_sort_order,
        }
      : undefined,
  };
}

function mapLink(row) {
  if (!row) return null;
  return {
    id: row.id,
    stageRunId: row.stage_run_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    role: row.role,
    note: row.note,
    createdAt: row.created_at,
  };
}

function mapMilestone(row) {
  if (!row) return null;
  return {
    id: row.id,
    stageRunId: row.stage_run_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    milestoneAt: row.milestone_at,
    status: row.status,
    taskId: row.task_id,
    plannerEventId: row.planner_event_id,
    sortOrder: row.sort_order,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMilestoneTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    stage: row.stage,
    slug: row.slug,
    title: row.title,
    description: row.description,
    offsetDays: row.offset_days,
    sortOrder: row.sort_order,
  };
}

export const ProjectStageRepository = {
  async findRun(projectId, stage) {
    const { rows } = await pool.query(
      `SELECT * FROM project_stage_runs WHERE project_id = $1 AND stage = $2`,
      [Number(projectId), stage]
    );
    return mapRun(rows[0]);
  },

  async listRunsByProjectId(projectId) {
    const { rows } = await pool.query(
      `SELECT * FROM project_stage_runs
       WHERE project_id = $1
       ORDER BY id ASC`,
      [Number(projectId)]
    );
    return rows.map(mapRun);
  },

  async findRunById(id) {
    const { rows } = await pool.query(
      `SELECT * FROM project_stage_runs WHERE id = $1`,
      [Number(id)]
    );
    return mapRun(rows[0]);
  },

  async createRun({ projectId, stage, status = 'not_started' }) {
    const { rows } = await pool.query(
      `INSERT INTO project_stage_runs (project_id, stage, status, started_at)
       VALUES ($1, $2, $3::varchar, CASE WHEN $3::varchar = 'in_progress' THEN NOW() ELSE NULL END)
       ON CONFLICT (project_id, stage) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [Number(projectId), stage, status]
    );
    return mapRun(rows[0]);
  },

  async updateRun(id, fields) {
    const sets = ['updated_at = NOW()'];
    const params = [Number(id)];
    let i = 2;

    if (fields.status !== undefined) {
      sets.push(`status = $${i++}`);
      params.push(fields.status);
    }
    if (fields.progressPercent !== undefined) {
      sets.push(`progress_percent = $${i++}`);
      params.push(fields.progressPercent);
    }
    if (fields.startedAt !== undefined) {
      sets.push(`started_at = $${i++}`);
      params.push(fields.startedAt);
    }
    if (fields.completedAt !== undefined) {
      sets.push(`completed_at = $${i++}`);
      params.push(fields.completedAt);
    }
    if (fields.summary !== undefined) {
      sets.push(`summary = $${i++}`);
      params.push(fields.summary);
    }
    if (fields.metadata !== undefined) {
      sets.push(`metadata = $${i++}`);
      params.push(JSON.stringify(fields.metadata ?? {}));
    }

    const { rows } = await pool.query(
      `UPDATE project_stage_runs SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return mapRun(rows[0]);
  },

  async listActiveActionsForStage(stage) {
    const { rows } = await pool.query(
      `SELECT a.*, t.slug AS template_slug, t.title AS template_title, t.sort_order AS template_sort_order
       FROM stage_workflow_actions a
       JOIN stage_workflow_templates t ON t.id = a.template_id
       WHERE t.stage = $1 AND t.is_active = TRUE AND a.is_active = TRUE
       ORDER BY t.sort_order ASC, a.sort_order ASC`,
      [stage]
    );
    return rows.map(mapAction);
  },

  async listMilestoneTemplates(stage) {
    const { rows } = await pool.query(
      `SELECT * FROM stage_milestone_templates
       WHERE stage = $1 AND is_active = TRUE
       ORDER BY sort_order ASC`,
      [stage]
    );
    return rows.map(mapMilestoneTemplate);
  },

  async seedTasks(stageRunId, actionIds) {
    if (!actionIds.length) return;
    const values = [];
    const params = [];
    let i = 1;
    for (const actionId of actionIds) {
      values.push(`($${i++}, $${i++})`);
      params.push(Number(stageRunId), Number(actionId));
    }
    await pool.query(
      `INSERT INTO project_stage_tasks (stage_run_id, action_id)
       VALUES ${values.join(', ')}
       ON CONFLICT (stage_run_id, action_id) DO NOTHING`,
      params
    );
  },

  async seedMilestones(stageRunId, milestones) {
    if (!milestones.length) return;
    const values = [];
    const params = [];
    let i = 1;
    for (const m of milestones) {
      values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
      params.push(
        Number(stageRunId),
        m.slug,
        m.title,
        m.description ?? null,
        m.milestoneAt,
        m.sortOrder ?? 0
      );
    }
    await pool.query(
      `INSERT INTO project_stage_milestones
         (stage_run_id, slug, title, description, milestone_at, sort_order)
       VALUES ${values.join(', ')}
       ON CONFLICT (stage_run_id, slug) DO NOTHING`,
      params
    );
  },

  async listTasks(stageRunId) {
    const { rows } = await pool.query(
      `SELECT t.*,
              a.slug AS action_slug,
              a.title AS action_title,
              a.description AS action_description,
              a.is_required AS action_is_required,
              a.sort_order AS action_sort_order,
              w.slug AS template_slug,
              w.title AS template_title,
              w.sort_order AS template_sort_order
       FROM project_stage_tasks t
       JOIN stage_workflow_actions a ON a.id = t.action_id
       JOIN stage_workflow_templates w ON w.id = a.template_id
       WHERE t.stage_run_id = $1
       ORDER BY w.sort_order ASC, a.sort_order ASC`,
      [Number(stageRunId)]
    );
    return rows.map(mapTask);
  },

  async findTask(stageRunId, taskId) {
    const { rows } = await pool.query(
      `SELECT t.*,
              a.slug AS action_slug,
              a.title AS action_title,
              a.description AS action_description,
              a.is_required AS action_is_required,
              a.sort_order AS action_sort_order,
              w.slug AS template_slug,
              w.title AS template_title,
              w.sort_order AS template_sort_order
       FROM project_stage_tasks t
       JOIN stage_workflow_actions a ON a.id = t.action_id
       JOIN stage_workflow_templates w ON w.id = a.template_id
       WHERE t.stage_run_id = $1 AND t.id = $2`,
      [Number(stageRunId), Number(taskId)]
    );
    return mapTask(rows[0]);
  },

  async updateTask(taskId, fields) {
    const sets = ['updated_at = NOW()'];
    const params = [Number(taskId)];
    let i = 2;

    if (fields.status !== undefined) {
      sets.push(`status = $${i++}`);
      params.push(fields.status);
    }
    if (fields.notes !== undefined) {
      sets.push(`notes = $${i++}`);
      params.push(fields.notes);
    }
    if (fields.dueAt !== undefined) {
      sets.push(`due_at = $${i++}`);
      params.push(fields.dueAt);
    }
    if (fields.completedAt !== undefined) {
      sets.push(`completed_at = $${i++}`);
      params.push(fields.completedAt);
    }
    if (fields.completedBy !== undefined) {
      sets.push(`completed_by = $${i++}`);
      params.push(fields.completedBy);
    }
    if (fields.plannerEventId !== undefined) {
      sets.push(`planner_event_id = $${i++}`);
      params.push(fields.plannerEventId);
    }
    if (fields.metadata !== undefined) {
      sets.push(`metadata = $${i++}`);
      params.push(JSON.stringify(fields.metadata ?? {}));
    }

    const { rows } = await pool.query(
      `UPDATE project_stage_tasks SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return mapTask(rows[0]);
  },

  async listLinks(stageRunId) {
    const { rows } = await pool.query(
      `SELECT * FROM project_stage_links WHERE stage_run_id = $1 ORDER BY created_at DESC`,
      [Number(stageRunId)]
    );
    return rows.map(mapLink);
  },

  async createLink({ stageRunId, entityType, entityId, role = null, note = null }) {
    const { rows } = await pool.query(
      `INSERT INTO project_stage_links (stage_run_id, entity_type, entity_id, role, note)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (stage_run_id, entity_type, entity_id)
       DO UPDATE SET role = COALESCE(EXCLUDED.role, project_stage_links.role),
                     note = COALESCE(EXCLUDED.note, project_stage_links.note)
       RETURNING *`,
      [Number(stageRunId), entityType, Number(entityId), role, note]
    );
    return mapLink(rows[0]);
  },

  async deleteLink(stageRunId, linkId) {
    const { rowCount } = await pool.query(
      `DELETE FROM project_stage_links WHERE stage_run_id = $1 AND id = $2`,
      [Number(stageRunId), Number(linkId)]
    );
    return rowCount > 0;
  },

  async listMilestones(stageRunId) {
    const { rows } = await pool.query(
      `SELECT * FROM project_stage_milestones
       WHERE stage_run_id = $1
       ORDER BY milestone_at ASC, sort_order ASC`,
      [Number(stageRunId)]
    );
    return rows.map(mapMilestone);
  },

  async findMilestone(stageRunId, milestoneId) {
    const { rows } = await pool.query(
      `SELECT * FROM project_stage_milestones WHERE stage_run_id = $1 AND id = $2`,
      [Number(stageRunId), Number(milestoneId)]
    );
    return mapMilestone(rows[0]);
  },

  async updateMilestone(milestoneId, fields) {
    const { rows } = await pool.query(
      `UPDATE project_stage_milestones
       SET title = COALESCE($2, title),
           description = COALESCE($3, description),
           milestone_at = COALESCE($4, milestone_at),
           status = COALESCE($5, status),
           task_id = COALESCE($6, task_id),
           planner_event_id = COALESCE($7, planner_event_id),
           metadata = COALESCE($8, metadata),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        Number(milestoneId),
        fields.title ?? null,
        fields.description !== undefined ? fields.description : null,
        fields.milestoneAt ?? null,
        fields.status ?? null,
        fields.taskId !== undefined ? fields.taskId : null,
        fields.plannerEventId !== undefined ? fields.plannerEventId : null,
        fields.metadata ? JSON.stringify(fields.metadata) : null,
      ]
    );
    return mapMilestone(rows[0]);
  },
};
