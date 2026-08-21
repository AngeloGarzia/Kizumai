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
    USERS ||--o{ REFRESH_TOKENS : "sessions (user_id)"
    USERS ||--o{ DOCUMENTS : "téléverse (uploaded_by)"
    USERS ||--o{ PUSH_SUBSCRIPTIONS : "abonne (user_id)"
    USERS ||--o{ USER_CONNECTIONS : "journalise (user_id)"
    USERS ||--o{ PLANNER_EVENTS : "planifie (user_id)"
    PROJECTS ||--o{ PLANNER_EVENTS : "lien optionnel (project_id)"
    USERS ||--o{ CONTACTS : "possède (user_id)"
    PROJECTS ||--o{ CONTACTS : "projet principal (project_id)"
    CONTACTS ||--o{ CONTACT_LINKS : "rattaché à N objets"
    USERS ||--o{ LEARNING_RECORDS : "parcours compétences (user_id)"
    PROJECTS ||--o{ LEARNING_RECORDS : "lien optionnel (project_id)"
    DOCUMENTS ||--o| LEARNING_RECORDS : "pièce jointe optionnelle (document_id)"
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

    REFRESH_TOKENS {
        uuid id PK
        int user_id FK
        text token_hash UK
        uuid family_id
        timestamptz expires_at
        timestamptz revoked_at
        uuid replaced_by FK
        timestamptz created_at
        timestamptz last_used_at
        text user_agent
        inet ip
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

    PLANNER_EVENTS {
        serial id PK
        int user_id FK
        int project_id FK
        varchar kind
        varchar title
        text description
        timestamptz start_at
        timestamptz end_at
        boolean all_day
        varchar status
        varchar location
        varchar color
        jsonb metadata
        timestamptz created_at
        timestamptz updated_at
    }

    CONTACTS {
        serial id PK
        int user_id FK
        int project_id FK
        varchar contact_type
        varchar category
        varchar first_name
        varchar last_name
        varchar display_name
        varchar job_title
        varchar organization
        varchar siren
        varchar email
        varchar phone
        varchar mobile
        jsonb emails
        jsonb phones
        varchar address_line1
        varchar postal_code
        varchar city
        varchar country
        date birthday
        jsonb tags
        text notes
        boolean is_favorite
        jsonb metadata
        timestamptz created_at
        timestamptz updated_at
    }

    CONTACT_LINKS {
        serial id PK
        int contact_id FK
        varchar entity_type
        int entity_id
        varchar role
        text note
        timestamptz created_at
    }

    LEARNING_RECORDS {
        serial id PK
        int user_id FK
        int project_id FK
        int document_id FK
        varchar record_type
        varchar title
        varchar organization
        varchar status
        varchar level
        varchar field
        varchar format
        date start_date
        date end_date
        varchar duration_label
        boolean diploma_obtained
        jsonb skills
        text description
        text notes
        varchar source
        jsonb ai_snapshot
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
| `users → refresh_tokens` | CASCADE |
| `projects → documents` | CASCADE |
| `users → push_subscriptions` | CASCADE |
| `users → planner_events` | CASCADE |
| `projects → planner_events` | SET NULL |
| `users → contacts` | CASCADE |
| `projects → contacts` | SET NULL |
| `contacts → contact_links` | CASCADE |
| `{project,document,planner_event,company} → contact_links` | CASCADE (trigger, `entity_id` polymorphe) |
| `users → learning_records` | CASCADE |
| `projects → learning_records` | SET NULL |
| `documents → learning_records` | SET NULL |
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
| `projects → project_memory_nodes` | CASCADE |
| `projects → project_memory_edges` | CASCADE |
| `projects → project_memory_snapshots` | CASCADE |
| `project_memory_nodes → edges` | CASCADE |

## Contraintes CHECK

- `users.plan` ∈ `{ free, paid }`
- `projects.status` ∈ `{ draft, active, paused, launched, archived }`
- `projects.stage` ∈ `{ idee, etude_marche, business_plan, financement, immatriculation, lancement }`
- `companies.lifecycle_state` ∈ `{ projet, en_creation, immatriculee, active, suspendue, cessee }`
- `companies.legal_status` ∈ `{ active, dormant, dissoute, radiee, liquidation }`
- `company_officers.person_type` ∈ `{ physique, morale }` · `ownership_percent` ∈ `[0, 100]`
- `accounting_profiles.status` ∈ `{ brouillon, pret, transmis }` · `accounting_standard` ∈ `{ PCG, IFRS, OTHER }`
- `accounting_profiles.tax_regime` ∈ `{ IS, IR_BIC, IR_BNC, micro }` · `vat_regime` ∈ `{ franchise, reel_simplifie, reel_normal, none }`
- `planner_events.kind` ∈ `{ task, deadline, appointment, reminder }` · `status` ∈ `{ todo, in_progress, done, cancelled }` · `end_at ≥ start_at`
- `contacts.contact_type` ∈ `{ person, company }` · `preferred_channel` ∈ `{ email, phone, mobile }`
- `contact_links.entity_type` ∈ `{ project, document, planner_event, company }` · unique `(contact_id, entity_type, entity_id)`
- `learning_records.record_type` ∈ `{ formation, diplome, etude, bilan_competences }`
- `learning_records.status` ∈ `{ envisage, en_cours, termine, abandonne }`
- `learning_records.format` ∈ `{ en_ligne, presentiel, mixte }` · `source` ∈ `{ manual, ai_suggestion, import }`
- `learning_records.end_date ≥ start_date` (si les deux sont renseignés)
- `project_memory_nodes.node_type` ∈ `{ fact, decision, event, task_state, milestone, insight, risk }`
- `project_memory_edges.relation_type` ∈ `{ causes, depends_on, blocks, relates_to, follows, contradicts, reinforces }`
