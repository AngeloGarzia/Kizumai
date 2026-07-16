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

## Contraintes CHECK

- `users.plan` ∈ `{ free, paid }`
- `projects.status` ∈ `{ draft, active, paused, launched, archived }`
- `projects.stage` ∈ `{ idee, etude_marche, business_plan, financement, immatriculation, lancement }`
