import pool from '../database/pool.js';

export const mapFinancial = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    fiscalYear: row.fiscal_year,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    currency: row.currency,
    revenue: row.revenue != null ? Number(row.revenue) : null,
    netIncome: row.net_income != null ? Number(row.net_income) : null,
    grossOperatingSurplus:
      row.gross_operating_surplus != null ? Number(row.gross_operating_surplus) : null,
    totalAssets: row.total_assets != null ? Number(row.total_assets) : null,
    equity: row.equity != null ? Number(row.equity) : null,
    headcount: row.headcount,
    isPublished: row.is_published,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const CompanyFinancialModel = {
  // Idempotent par (company_id, fiscal_year).
  async upsert({
    companyId,
    fiscalYear,
    periodStart = null,
    periodEnd = null,
    currency = 'EUR',
    revenue = null,
    netIncome = null,
    grossOperatingSurplus = null,
    totalAssets = null,
    equity = null,
    headcount = null,
    isPublished = false,
  }) {
    const { rows } = await pool.query(
      `INSERT INTO company_financials
         (company_id, fiscal_year, period_start, period_end, currency, revenue, net_income,
          gross_operating_surplus, total_assets, equity, headcount, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (company_id, fiscal_year) DO UPDATE SET
         period_start = EXCLUDED.period_start,
         period_end = EXCLUDED.period_end,
         currency = EXCLUDED.currency,
         revenue = EXCLUDED.revenue,
         net_income = EXCLUDED.net_income,
         gross_operating_surplus = EXCLUDED.gross_operating_surplus,
         total_assets = EXCLUDED.total_assets,
         equity = EXCLUDED.equity,
         headcount = EXCLUDED.headcount,
         is_published = EXCLUDED.is_published,
         updated_at = NOW()
       RETURNING *`,
      [
        companyId,
        fiscalYear,
        periodStart,
        periodEnd,
        currency,
        revenue,
        netIncome,
        grossOperatingSurplus,
        totalAssets,
        equity,
        headcount,
        isPublished,
      ]
    );
    return mapFinancial(rows[0]);
  },

  async findByCompanyId(companyId) {
    const { rows } = await pool.query(
      'SELECT * FROM company_financials WHERE company_id = $1 ORDER BY fiscal_year DESC',
      [Number(companyId)]
    );
    return rows.map(mapFinancial);
  },
};
