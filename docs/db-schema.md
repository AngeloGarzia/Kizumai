# Schéma de la base de données — Kizumai

Ce document est la représentation versionnée du schéma PostgreSQL.
La **source de vérité** reste les migrations : `backend/src/database/migrations/*.sql`.

## Comment l'éditer

- **GitHub / VS Code** : le diagramme Mermaid ci-dessous se rend automatiquement sur
  GitHub. Dans VS Code, installer l'extension *Markdown Preview Mermaid Support* (ou
  *Mermaid Preview*), ou éditer en ligne sur [mermaid.live](https://mermaid.live).
- **dbdiagram.io** : importer `docs/db-schema.dbml` (gratuit, éditeur visuel + DSL).

## Diagramme

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : "possède (user_id)"
    USERS ||--o{ DOCUMENTS : "téléverse (uploaded_by)"
    USERS ||--o{ PUSH_SUBSCRIPTIONS : "abonne (user_id)"
    USERS ||--o{ USER_CONNECTIONS : "journalise (user_id)"
    ACTIVITIES ||--o{ PROJECTS : "quoi (activity_id)"
    LOCATIONS ||--o{ PROJECTS : "où (location_id)"
    PROJECTS ||--o{ DOCUMENTS : "regroupe (project_id)"
    PROJECTS ||--|| COMPANIES : "donne naissance (project_id)"
    ACTIVITIES ||--o{ COMPANIES : "activity_id"
    LOCATIONS ||--o{ COMPANIES : "siège (location_id)"
    COMPANIES ||--o{ COMPANY_ESTABLISHMENTS : "établissements"
    COMPANIES ||--o{ COMPANY_OFFICERS : "dirigeants / BE"
    COMPANIES ||--o{ COMPANY_FINANCIALS : "comptes annuels"
    COMPANIES ||--|| ACCOUNTING_PROFILES : "profil comptable (company_id)"
    LOCATIONS ||--o{ COMPANY_ESTABLISHMENTS : "location_id"

    USERS {
        serial id PK
        varchar name
        varchar email UK
        varchar password
        int refresh_token_version
        varchar role
        varchar plan
        timestamptz created_at
        timestamptz updated_at
    }

    PROJECTS {
        serial id PK
        int user_id FK
        int activity_id FK
        int location_id FK
        varchar title
        int budget
        varchar currency
        varchar legal_form
        varchar status
        varchar stage
        text description
        text report
        jsonb sections
        jsonb metadata
        varchar source
        text ai_prompt
        timestamptz created_at
        timestamptz updated_at
    }

    ACTIVITIES {
        serial id PK
        varchar label UK
        varchar sector
        varchar sub_sector
        varchar ape_code
        text description
        jsonb keywords
        jsonb metadata
        timestamptz created_at
        timestamptz updated_at
    }

    LOCATIONS {
        serial id PK
        varchar label UK
        varchar address_line1
        varchar address_line2
        varchar postal_code
        varchar city
        varchar region
        varchar department
        varchar country
        numeric latitude
        numeric longitude
        varchar geo_place_id
        jsonb metadata
        timestamptz created_at
        timestamptz updated_at
    }

    DOCUMENTS {
        serial id PK
        int project_id FK
        int uploaded_by FK
        varchar type
        varchar title
        varchar file_name
        text storage_key
        varchar mime_type
        bigint size_bytes
        jsonb attributes
        timestamptz created_at
        timestamptz updated_at
    }

    COMPANIES {
        serial id PK
        int project_id FK
        int activity_id FK
        int location_id FK
        varchar denomination
        varchar trade_name
        varchar legal_form_label
        varchar legal_status
        varchar country_code
        varchar siren
        varchar siret_hq
        varchar naf_ape_code
        varchar rcs_number
        varchar vat_number
        varchar lei
        varchar duns
        varchar foreign_reg_number
        numeric share_capital
        int headcount
        date incorporation_date
        boolean is_registered
        varchar lifecycle_state
        jsonb registration_progress
        varchar email
        varchar website
        varchar source
        jsonb external_data
        jsonb metadata
        timestamptz created_at
        timestamptz updated_at
    }

    COMPANY_ESTABLISHMENTS {
        serial id PK
        int company_id FK
        int location_id FK
        varchar siret
        varchar label
        boolean is_headquarters
        boolean is_active
        int headcount
        varchar naf_ape_code
        date opened_at
        date closed_at
        jsonb metadata
        timestamptz created_at
        timestamptz updated_at
    }

    COMPANY_OFFICERS {
        serial id PK
        int company_id FK
        varchar role
        boolean is_beneficial_owner
        varchar person_type
        varchar person_name
        date birth_date
        varchar nationality
        numeric ownership_percent
        int linked_company_id FK
        date mandate_start
        date mandate_end
        jsonb metadata
        timestamptz created_at
        timestamptz updated_at
    }

    COMPANY_FINANCIALS {
        serial id PK
        int company_id FK
        int fiscal_year
        date period_start
        date period_end
        varchar currency
        numeric revenue
        numeric net_income
        numeric total_assets
        numeric equity
        int headcount
        boolean is_published
        jsonb metadata
        timestamptz created_at
        timestamptz updated_at
    }

    ACCOUNTING_PROFILES {
        serial id PK
        int company_id FK
        varchar tax_regime
        boolean is_option
        varchar vat_regime
        varchar vat_periodicity
        varchar accounting_standard
        varchar fiscal_year_start
        varchar fiscal_year_end
        date first_closing_date
        varchar firm_name
        jsonb firm_contact
        varchar firm_siren
        date mission_start_date
        boolean mission_letter_signed
        jsonb bank_accounts
        varchar director_social_regime
        varchar collective_agreement
        varchar idcc_code
        jsonb social_organizations
        varchar invoicing_software
        varchar transmission_mode
        numeric estimated_annual_revenue
        int estimated_monthly_invoices
        varchar status
        timestamptz transmitted_at
        text notes
        jsonb metadata
        timestamptz created_at
        timestamptz updated_at
    }

    PUSH_SUBSCRIPTIONS {
        serial id PK
        int user_id FK
        text endpoint UK
        text p256dh
        text auth
        text user_agent
        timestamptz created_at
        timestamptz updated_at
    }

    USER_CONNECTIONS {
        serial id PK
        int user_id FK
        varchar email
        varchar action
        varchar ip_address
        text user_agent
        timestamptz created_at
    }

    AI_PROMPTS {
        serial id PK
        varchar prompt_key UK
        varchar name
        varchar role
        text content
        timestamptz updated_at
    }

    APP_SETTINGS {
        varchar key PK
        text value
        timestamptz updated_at
    }

    SCHEMA_MIGRATIONS {
        serial id PK
        varchar filename UK
        timestamptz applied_at
    }
```

## Règles de suppression (ON DELETE)

| Relation | Règle |
|---|---|
| `users → projects` | CASCADE |
| `projects → documents` | CASCADE |
| `users → push_subscriptions` | CASCADE |
| `activities → projects` | SET NULL |
| `locations → projects` | SET NULL |
| `users → documents` (uploaded_by) | SET NULL |
| `users → user_connections` | SET NULL |
| `projects → companies` | CASCADE |
| `companies → company_establishments` | CASCADE |
| `companies → company_officers` | CASCADE |
| `companies → company_financials` | CASCADE |
| `activities/locations → companies` | SET NULL |
| `companies → accounting_profiles` | CASCADE |

## Contraintes CHECK

- `users.plan` ∈ `{ free, paid }`
- `projects.status` ∈ `{ draft, active, paused, launched, archived }`
- `projects.stage` ∈ `{ idee, etude_marche, business_plan, financement, immatriculation, lancement }`
- `companies.lifecycle_state` ∈ `{ projet, en_creation, immatriculee, active, suspendue, cessee }`
- `companies.legal_status` ∈ `{ active, dormant, dissoute, radiee, liquidation }`
- `company_officers.person_type` ∈ `{ physique, morale }` · `ownership_percent` ∈ `[0, 100]`
- `accounting_profiles.status` ∈ `{ brouillon, pret, transmis }` · `accounting_standard` ∈ `{ PCG, IFRS, OTHER }`
- `accounting_profiles.tax_regime` ∈ `{ IS, IR_BIC, IR_BNC, micro }` · `vat_regime` ∈ `{ franchise, reel_simplifie, reel_normal, none }`
