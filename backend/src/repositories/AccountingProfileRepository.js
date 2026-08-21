import pool from '../database/pool.js';

export const mapAccountingProfile = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,

    taxRegime: row.tax_regime,
    isOption: row.is_option,
    vatRegime: row.vat_regime,
    vatPeriodicity: row.vat_periodicity,

    accountingStandard: row.accounting_standard,
    fiscalYearStart: row.fiscal_year_start,
    fiscalYearEnd: row.fiscal_year_end,
    firstClosingDate: row.first_closing_date,

    firmName: row.firm_name,
    firmContact: row.firm_contact ?? {},
    firmSiren: row.firm_siren,
    missionStartDate: row.mission_start_date,
    missionLetterSigned: row.mission_letter_signed,

    bankAccounts: row.bank_accounts ?? [],

    directorSocialRegime: row.director_social_regime,
    collectiveAgreement: row.collective_agreement,
    idccCode: row.idcc_code,
    socialOrganizations: row.social_organizations ?? {},

    invoicingSoftware: row.invoicing_software,
    transmissionMode: row.transmission_mode,
    estimatedAnnualRevenue:
      row.estimated_annual_revenue != null ? Number(row.estimated_annual_revenue) : null,
    estimatedMonthlyInvoices: row.estimated_monthly_invoices,

    status: row.status,
    transmittedAt: row.transmitted_at,
    notes: row.notes,
    metadata: row.metadata ?? {},

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const UPDATABLE = {
  taxRegime: 'tax_regime',
  isOption: 'is_option',
  vatRegime: 'vat_regime',
  vatPeriodicity: 'vat_periodicity',
  accountingStandard: 'accounting_standard',
  fiscalYearStart: 'fiscal_year_start',
  fiscalYearEnd: 'fiscal_year_end',
  firstClosingDate: 'first_closing_date',
  firmName: 'firm_name',
  firmSiren: 'firm_siren',
  missionStartDate: 'mission_start_date',
  missionLetterSigned: 'mission_letter_signed',
  directorSocialRegime: 'director_social_regime',
  collectiveAgreement: 'collective_agreement',
  idccCode: 'idcc_code',
  invoicingSoftware: 'invoicing_software',
  transmissionMode: 'transmission_mode',
  estimatedAnnualRevenue: 'estimated_annual_revenue',
  estimatedMonthlyInvoices: 'estimated_monthly_invoices',
  status: 'status',
  transmittedAt: 'transmitted_at',
  notes: 'notes',
};

const JSON_FIELDS = {
  firmContact: 'firm_contact',
  bankAccounts: 'bank_accounts',
  socialOrganizations: 'social_organizations',
  metadata: 'metadata',
};

export const AccountingProfileRepository = {
  async create({ companyId, accountingStandard = 'PCG', status = 'brouillon' }) {
    const { rows } = await pool.query(
      `INSERT INTO accounting_profiles (company_id, accounting_standard, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [companyId, accountingStandard, status]
    );
    return mapAccountingProfile(rows[0]);
  },

  async findByCompanyId(companyId) {
    const { rows } = await pool.query(
      'SELECT * FROM accounting_profiles WHERE company_id = $1',
      [Number(companyId)]
    );
    return mapAccountingProfile(rows[0]);
  },

  // Mise à jour partielle : seuls les champs fournis sont écrits.
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
    for (const [key, col] of Object.entries(JSON_FIELDS)) {
      if (data[key] !== undefined) {
        setClauses.push(`${col} = $${i}`);
        values.push(JSON.stringify(data[key]));
        i += 1;
      }
    }

    if (setClauses.length === 0) return this.findById(id);

    const { rows } = await pool.query(
      `UPDATE accounting_profiles SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      values
    );
    return mapAccountingProfile(rows[0]);
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM accounting_profiles WHERE id = $1', [
      Number(id),
    ]);
    return mapAccountingProfile(rows[0]);
  },
};

