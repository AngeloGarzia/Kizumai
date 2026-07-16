import pool from '../database/pool.js';

export const mapCompany = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    activityId: row.activity_id,
    locationId: row.location_id,

    denomination: row.denomination,
    tradeName: row.trade_name,
    acronym: row.acronym,
    previousNames: row.previous_names ?? [],
    logoUrl: row.logo_url,

    legalFormCode: row.legal_form_code,
    legalFormLabel: row.legal_form_label,
    legalStatus: row.legal_status,
    isHeadquarters: row.is_headquarters,
    countryCode: row.country_code,

    siren: row.siren,
    siretHq: row.siret_hq,
    nafApeCode: row.naf_ape_code,
    rcsNumber: row.rcs_number,
    rcsCity: row.rcs_city,
    vatNumber: row.vat_number,
    euId: row.eu_id,
    lei: row.lei,
    duns: row.duns,
    foreignRegNumber: row.foreign_reg_number,
    foreignRegAuthority: row.foreign_reg_authority,
    taxId: row.tax_id,

    activityDescription: row.activity_description,

    shareCapital: row.share_capital != null ? Number(row.share_capital) : null,
    capitalCurrency: row.capital_currency,
    revenueLast: row.revenue_last != null ? Number(row.revenue_last) : null,
    netIncomeLast: row.net_income_last != null ? Number(row.net_income_last) : null,
    fiscalYearEnd: row.fiscal_year_end,

    headcount: row.headcount,
    headcountRange: row.headcount_range,

    incorporationDate: row.incorporation_date,
    activityStartDate: row.activity_start_date,
    cessationDate: row.cessation_date,
    isRegistered: row.is_registered,
    lifecycleState: row.lifecycle_state,
    registrationProgress: row.registration_progress ?? {},

    email: row.email,
    phone: row.phone,
    website: row.website,
    socialLinks: row.social_links ?? {},

    source: row.source,
    externalData: row.external_data ?? {},
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

// Colonnes modifiables via update() → nom SQL.
const UPDATABLE = {
  activityId: 'activity_id',
  locationId: 'location_id',
  denomination: 'denomination',
  tradeName: 'trade_name',
  acronym: 'acronym',
  logoUrl: 'logo_url',
  legalFormCode: 'legal_form_code',
  legalFormLabel: 'legal_form_label',
  legalStatus: 'legal_status',
  isHeadquarters: 'is_headquarters',
  countryCode: 'country_code',
  siren: 'siren',
  siretHq: 'siret_hq',
  nafApeCode: 'naf_ape_code',
  rcsNumber: 'rcs_number',
  rcsCity: 'rcs_city',
  vatNumber: 'vat_number',
  euId: 'eu_id',
  lei: 'lei',
  duns: 'duns',
  foreignRegNumber: 'foreign_reg_number',
  foreignRegAuthority: 'foreign_reg_authority',
  taxId: 'tax_id',
  activityDescription: 'activity_description',
  shareCapital: 'share_capital',
  capitalCurrency: 'capital_currency',
  revenueLast: 'revenue_last',
  netIncomeLast: 'net_income_last',
  fiscalYearEnd: 'fiscal_year_end',
  headcount: 'headcount',
  headcountRange: 'headcount_range',
  incorporationDate: 'incorporation_date',
  activityStartDate: 'activity_start_date',
  cessationDate: 'cessation_date',
  isRegistered: 'is_registered',
  lifecycleState: 'lifecycle_state',
  email: 'email',
  phone: 'phone',
  website: 'website',
};

const JSON_FIELDS = {
  previousNames: 'previous_names',
  registrationProgress: 'registration_progress',
  socialLinks: 'social_links',
  externalData: 'external_data',
  metadata: 'metadata',
};

export const CompanyModel = {
  async create(data = {}) {
    const {
      projectId,
      activityId = null,
      locationId = null,
      denomination = null,
      tradeName = null,
      legalFormLabel = null,
      countryCode = 'FR',
      lifecycleState = 'projet',
      source = 'project',
    } = data;

    const { rows } = await pool.query(
      `INSERT INTO companies
         (project_id, activity_id, location_id, denomination, trade_name,
          legal_form_label, country_code, lifecycle_state, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        projectId,
        activityId,
        locationId,
        denomination,
        tradeName,
        legalFormLabel,
        countryCode,
        lifecycleState,
        source,
      ]
    );
    return mapCompany(rows[0]);
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM companies WHERE id = $1', [Number(id)]);
    return mapCompany(rows[0]);
  },

  async findByProjectId(projectId) {
    const { rows } = await pool.query('SELECT * FROM companies WHERE project_id = $1', [
      Number(projectId),
    ]);
    return mapCompany(rows[0]);
  },

  // Mise à jour partielle : seuls les champs fournis (non undefined) sont écrits,
  // ce qui reflète le remplissage progressif de la fiche.
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
      `UPDATE companies SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      values
    );
    return mapCompany(rows[0]);
  },
};
