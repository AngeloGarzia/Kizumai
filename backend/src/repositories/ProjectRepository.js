import pool from '../database/pool.js';
import { mapActivity } from './ActivityRepository.js';
import { mapLocation } from './LocationRepository.js';

const SELECT_WITH_RELATIONS = `
  SELECT
    p.*,
    a.id   AS a_id,   a.label AS a_label, a.sector AS a_sector, a.sub_sector AS a_sub_sector,
    a.ape_code AS a_ape_code, a.description AS a_description, a.keywords AS a_keywords,
    a.metadata AS a_metadata, a.created_at AS a_created_at, a.updated_at AS a_updated_at,
    l.id AS l_id, l.label AS l_label, l.address_line1 AS l_address_line1, l.address_line2 AS l_address_line2,
    l.postal_code AS l_postal_code, l.city AS l_city, l.region AS l_region, l.department AS l_department,
    l.country AS l_country, l.latitude AS l_latitude, l.longitude AS l_longitude,
    l.geo_place_id AS l_geo_place_id, l.metadata AS l_metadata,
    l.created_at AS l_created_at, l.updated_at AS l_updated_at
  FROM projects p
  LEFT JOIN activities a ON a.id = p.activity_id
  LEFT JOIN locations l ON l.id = p.location_id
`;

const mapProject = (row) => {
  if (!row) return null;

  const activity = row.a_id
    ? mapActivity({
        id: row.a_id,
        label: row.a_label,
        sector: row.a_sector,
        sub_sector: row.a_sub_sector,
        ape_code: row.a_ape_code,
        description: row.a_description,
        keywords: row.a_keywords,
        metadata: row.a_metadata,
        created_at: row.a_created_at,
        updated_at: row.a_updated_at,
      })
    : null;

  const location = row.l_id
    ? mapLocation({
        id: row.l_id,
        label: row.l_label,
        address_line1: row.l_address_line1,
        address_line2: row.l_address_line2,
        postal_code: row.l_postal_code,
        city: row.l_city,
        region: row.l_region,
        department: row.l_department,
        country: row.l_country,
        latitude: row.l_latitude,
        longitude: row.l_longitude,
        geo_place_id: row.l_geo_place_id,
        metadata: row.l_metadata,
        created_at: row.l_created_at,
        updated_at: row.l_updated_at,
      })
    : null;

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    activityId: row.activity_id,
    locationId: row.location_id,
    activity,
    location,
    // Compat rétro : libellés dérivés pour l'affichage.
    quoi: activity?.label ?? null,
    ou: location?.label ?? null,
    budget: row.budget,
    currency: row.currency,
    legalForm: row.legal_form,
    status: row.status,
    stage: row.stage,
    description: row.description,
    report: row.report,
    sections: row.sections ?? [],
    metadata: row.metadata ?? {},
    source: row.source,
    aiPrompt: row.ai_prompt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const ProjectRepository = {
  async create({
    userId,
    title = null,
    activityId = null,
    locationId = null,
    budget = null,
    currency = 'EUR',
    legalForm = null,
    status = 'draft',
    stage = 'idee',
    description = null,
    report = null,
    sections = [],
    source = 'manual',
    aiPrompt = null,
  }) {
    const { rows } = await pool.query(
      `INSERT INTO projects
         (user_id, title, activity_id, location_id, budget, currency, legal_form, status, stage, description, report, sections, source, ai_prompt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        userId ?? null,
        title,
        activityId,
        locationId,
        budget,
        currency,
        legalForm,
        status,
        stage,
        description,
        report,
        JSON.stringify(sections),
        source,
        aiPrompt,
      ]
    );
    return this.findById(rows[0].id);
  },

  async findByUserId(userId) {
    const { rows } = await pool.query(
      `${SELECT_WITH_RELATIONS} WHERE p.user_id = $1 ORDER BY p.created_at DESC`,
      [Number(userId)]
    );
    return rows.map(mapProject);
  },

  async findById(id) {
    const { rows } = await pool.query(`${SELECT_WITH_RELATIONS} WHERE p.id = $1`, [Number(id)]);
    return mapProject(rows[0]);
  },

  async updateLifecycle(id, { title, status, stage, legalForm, description }) {
    const { rows } = await pool.query(
      `UPDATE projects
       SET title = COALESCE($2, title),
           status = COALESCE($3, status),
           stage = COALESCE($4, stage),
           legal_form = COALESCE($5, legal_form),
           description = COALESCE($6, description),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [Number(id), title ?? null, status ?? null, stage ?? null, legalForm ?? null, description ?? null]
    );
    if (!rows[0]) return null;
    return this.findById(rows[0].id);
  },

  async setLocationId(id, locationId) {
    const { rows } = await pool.query(
      `UPDATE projects
       SET location_id = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [Number(id), locationId == null ? null : Number(locationId)]
    );
    if (!rows[0]) return null;
    return this.findById(rows[0].id);
  },
};

