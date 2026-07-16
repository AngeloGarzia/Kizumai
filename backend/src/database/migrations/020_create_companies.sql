-- Sociétés (France + international), créées À PARTIR d'un projet.
-- Principe : la fiche société naît comme un squelette rattaché au projet et
-- se garnit AU FUR ET À MESURE que le projet avance et que les autorisations
-- sont acquises. La quasi-totalité des colonnes est donc nullable.
--
-- `lifecycle_state` matérialise cette progression (aucune société « fictive »
-- déjà immatriculée n'est supposée par défaut).

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,

  -- Rattachement application (1 société par projet)
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,

  -- 1. Identité
  denomination VARCHAR(255),
  trade_name VARCHAR(255),
  acronym VARCHAR(60),
  previous_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  logo_url TEXT,

  -- 2. Nature juridique
  legal_form_code VARCHAR(10),
  legal_form_label VARCHAR(120),
  legal_status VARCHAR(30) NOT NULL DEFAULT 'active',
  is_headquarters BOOLEAN NOT NULL DEFAULT TRUE,
  country_code VARCHAR(2) NOT NULL DEFAULT 'FR',

  -- 3. Immatriculations (FR + international)
  siren VARCHAR(9),
  siret_hq VARCHAR(14),
  naf_ape_code VARCHAR(6),
  rcs_number VARCHAR(40),
  rcs_city VARCHAR(120),
  vat_number VARCHAR(30),
  eu_id VARCHAR(40),
  lei VARCHAR(20),
  duns VARCHAR(9),
  foreign_reg_number VARCHAR(60),
  foreign_reg_authority VARCHAR(120),
  tax_id VARCHAR(60),

  -- 4. Activité / objet social
  activity_description TEXT,

  -- 5. Capital & finances (résumé)
  share_capital NUMERIC(18,2),
  capital_currency VARCHAR(3) DEFAULT 'EUR',
  revenue_last NUMERIC(18,2),
  net_income_last NUMERIC(18,2),
  fiscal_year_end VARCHAR(5),

  -- 6. Effectifs
  headcount INTEGER,
  headcount_range VARCHAR(30),

  -- 7. Dates & cycle de vie
  incorporation_date DATE,
  activity_start_date DATE,
  cessation_date DATE,
  is_registered BOOLEAN NOT NULL DEFAULT FALSE,
  lifecycle_state VARCHAR(20) NOT NULL DEFAULT 'projet',
  registration_progress JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 8. Contact & web
  email VARCHAR(255),
  phone VARCHAR(40),
  website VARCHAR(255),
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 9. Source & extensibilité
  source VARCHAR(30) NOT NULL DEFAULT 'project',
  external_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_companies_lifecycle CHECK (
    lifecycle_state IN ('projet', 'en_creation', 'immatriculee', 'active', 'suspendue', 'cessee')
  ),
  CONSTRAINT chk_companies_legal_status CHECK (
    legal_status IN ('active', 'dormant', 'dissoute', 'radiee', 'liquidation')
  )
);

-- Une seule société par projet.
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_project ON companies (project_id);

-- Identifiants uniques SEULEMENT lorsqu'ils sont renseignés (remplissage progressif).
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_siren ON companies (siren) WHERE siren IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_siret_hq ON companies (siret_hq) WHERE siret_hq IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_vat ON companies (vat_number) WHERE vat_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_lei ON companies (lei) WHERE lei IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_companies_denomination ON companies (lower(denomination));
CREATE INDEX IF NOT EXISTS idx_companies_activity ON companies (activity_id);
CREATE INDEX IF NOT EXISTS idx_companies_location ON companies (location_id);
CREATE INDEX IF NOT EXISTS idx_companies_country ON companies (country_code);


-- ── Satellite : établissements (1 société = N établissements) ──
CREATE TABLE IF NOT EXISTS company_establishments (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  siret VARCHAR(14),
  label VARCHAR(200),
  is_headquarters BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  headcount INTEGER,
  naf_ape_code VARCHAR(6),
  opened_at DATE,
  closed_at DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_establishments_company ON company_establishments (company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_establishments_siret ON company_establishments (siret) WHERE siret IS NOT NULL;


-- ── Satellite : dirigeants & bénéficiaires effectifs (1 société = N personnes) ──
CREATE TABLE IF NOT EXISTS company_officers (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role VARCHAR(60) NOT NULL DEFAULT 'dirigeant',
  is_beneficial_owner BOOLEAN NOT NULL DEFAULT FALSE,
  person_type VARCHAR(20) NOT NULL DEFAULT 'physique',
  person_name VARCHAR(255) NOT NULL,
  birth_date DATE,
  nationality VARCHAR(60),
  ownership_percent NUMERIC(5,2),
  linked_company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  mandate_start DATE,
  mandate_end DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_officers_person_type CHECK (person_type IN ('physique', 'morale')),
  CONSTRAINT chk_officers_ownership CHECK (
    ownership_percent IS NULL OR (ownership_percent >= 0 AND ownership_percent <= 100)
  )
);

CREATE INDEX IF NOT EXISTS idx_officers_company ON company_officers (company_id);


-- ── Satellite : comptes annuels (1 société = N exercices) ──
CREATE TABLE IF NOT EXISTS company_financials (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  period_start DATE,
  period_end DATE,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  revenue NUMERIC(18,2),
  net_income NUMERIC(18,2),
  gross_operating_surplus NUMERIC(18,2),
  total_assets NUMERIC(18,2),
  equity NUMERIC(18,2),
  headcount INTEGER,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financials_company ON company_financials (company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_financials_company_year
  ON company_financials (company_id, fiscal_year);
