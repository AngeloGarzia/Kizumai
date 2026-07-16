-- Profil comptable d'une société : UNIQUEMENT les données comptables/fiscales
-- absentes du reste de la base. Le « dossier de transmission » complet à
-- envoyer à l'expert-comptable est ASSEMBLÉ par jointure (companies +
-- company_officers + company_establishments + documents + cette table) : on ne
-- duplique donc pas l'identité légale, le capital, les associés ni les pièces.
--
-- 1 profil par société. Tout est nullable : la fiche se garnit pendant la
-- création et passe à `transmis` quand elle est envoyée au cabinet.

CREATE TABLE IF NOT EXISTS accounting_profiles (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Fiscalité
  tax_regime VARCHAR(30),
  is_option BOOLEAN,
  vat_regime VARCHAR(30),
  vat_periodicity VARCHAR(20),

  -- Exercice comptable
  accounting_standard VARCHAR(20) NOT NULL DEFAULT 'PCG',
  fiscal_year_start VARCHAR(5),
  fiscal_year_end VARCHAR(5),
  first_closing_date DATE,

  -- Cabinet comptable & mission
  firm_name VARCHAR(200),
  firm_contact JSONB NOT NULL DEFAULT '{}'::jsonb,
  firm_siren VARCHAR(9),
  mission_start_date DATE,
  mission_letter_signed BOOLEAN NOT NULL DEFAULT FALSE,

  -- Banque
  bank_accounts JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Social / paie
  director_social_regime VARCHAR(30),
  collective_agreement VARCHAR(120),
  idcc_code VARCHAR(10),
  social_organizations JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Outils & prévisionnel (dimensionnement de la mission)
  invoicing_software VARCHAR(120),
  transmission_mode VARCHAR(30),
  estimated_annual_revenue NUMERIC(18,2),
  estimated_monthly_invoices INTEGER,

  -- Suivi de la transmission
  status VARCHAR(20) NOT NULL DEFAULT 'brouillon',
  transmitted_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_accounting_status CHECK (status IN ('brouillon', 'pret', 'transmis')),
  CONSTRAINT chk_accounting_standard CHECK (accounting_standard IN ('PCG', 'IFRS', 'OTHER')),
  CONSTRAINT chk_accounting_tax_regime CHECK (
    tax_regime IS NULL OR tax_regime IN ('IS', 'IR_BIC', 'IR_BNC', 'micro')
  ),
  CONSTRAINT chk_accounting_vat_regime CHECK (
    vat_regime IS NULL OR vat_regime IN ('franchise', 'reel_simplifie', 'reel_normal', 'none')
  ),
  CONSTRAINT chk_accounting_vat_periodicity CHECK (
    vat_periodicity IS NULL OR vat_periodicity IN ('mensuelle', 'trimestrielle', 'annuelle')
  ),
  CONSTRAINT chk_accounting_director_regime CHECK (
    director_social_regime IS NULL OR director_social_regime IN ('TNS', 'assimile_salarie')
  ),
  CONSTRAINT chk_accounting_transmission_mode CHECK (
    transmission_mode IS NULL OR transmission_mode IN ('depot', 'email', 'api', 'papier')
  )
);

-- 1 profil comptable par société.
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_profiles_company
  ON accounting_profiles (company_id);
