import pool from '../database/pool.js';

export const mapEstablishment = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    locationId: row.location_id,
    siret: row.siret,
    label: row.label,
    isHeadquarters: row.is_headquarters,
    isActive: row.is_active,
    headcount: row.headcount,
    nafApeCode: row.naf_ape_code,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const CompanyEstablishmentModel = {
  async create({
    companyId,
    locationId = null,
    siret = null,
    label = null,
    isHeadquarters = false,
    isActive = true,
    headcount = null,
    nafApeCode = null,
    openedAt = null,
  }) {
    const { rows } = await pool.query(
      `INSERT INTO company_establishments
         (company_id, location_id, siret, label, is_headquarters, is_active, headcount, naf_ape_code, opened_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [companyId, locationId, siret, label, isHeadquarters, isActive, headcount, nafApeCode, openedAt]
    );
    return mapEstablishment(rows[0]);
  },

  async findByCompanyId(companyId) {
    const { rows } = await pool.query(
      'SELECT * FROM company_establishments WHERE company_id = $1 ORDER BY is_headquarters DESC, id ASC',
      [Number(companyId)]
    );
    return rows.map(mapEstablishment);
  },

  async delete(id) {
    const { rowCount } = await pool.query('DELETE FROM company_establishments WHERE id = $1', [
      Number(id),
    ]);
    return rowCount > 0;
  },
};
