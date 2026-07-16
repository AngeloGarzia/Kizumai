import pool from '../database/pool.js';

export const mapOfficer = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    role: row.role,
    isBeneficialOwner: row.is_beneficial_owner,
    personType: row.person_type,
    personName: row.person_name,
    birthDate: row.birth_date,
    nationality: row.nationality,
    ownershipPercent: row.ownership_percent != null ? Number(row.ownership_percent) : null,
    linkedCompanyId: row.linked_company_id,
    mandateStart: row.mandate_start,
    mandateEnd: row.mandate_end,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const CompanyOfficerModel = {
  async create({
    companyId,
    role = 'dirigeant',
    isBeneficialOwner = false,
    personType = 'physique',
    personName,
    birthDate = null,
    nationality = null,
    ownershipPercent = null,
    linkedCompanyId = null,
    mandateStart = null,
  }) {
    const { rows } = await pool.query(
      `INSERT INTO company_officers
         (company_id, role, is_beneficial_owner, person_type, person_name, birth_date,
          nationality, ownership_percent, linked_company_id, mandate_start)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        companyId,
        role,
        isBeneficialOwner,
        personType,
        personName,
        birthDate,
        nationality,
        ownershipPercent,
        linkedCompanyId,
        mandateStart,
      ]
    );
    return mapOfficer(rows[0]);
  },

  async findByCompanyId(companyId) {
    const { rows } = await pool.query(
      'SELECT * FROM company_officers WHERE company_id = $1 ORDER BY id ASC',
      [Number(companyId)]
    );
    return rows.map(mapOfficer);
  },

  async delete(id) {
    const { rowCount } = await pool.query('DELETE FROM company_officers WHERE id = $1', [
      Number(id),
    ]);
    return rowCount > 0;
  },
};
