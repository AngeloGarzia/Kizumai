#!/bin/bash
# Crée un rôle applicatif à privilèges minimaux (pas SUPERUSER / pas CREATEDB).
set -euo pipefail

: "${POSTGRES_APP_USER:?POSTGRES_APP_USER requis}"
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD requis}"
: "${POSTGRES_DB:?POSTGRES_DB requis}"
: "${POSTGRES_USER:?POSTGRES_USER requis}"

# Échappe les apostrophes pour littéraux SQL.
sql_lit() {
  printf "%s" "$1" | sed "s/'/''/g"
}

USER_LIT="$(sql_lit "$POSTGRES_APP_USER")"
PASS_LIT="$(sql_lit "$POSTGRES_APP_PASSWORD")"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "SELECT set_config('kizumai.app_user', '${USER_LIT}', false);" \
  -c "SELECT set_config('kizumai.app_password', '${PASS_LIT}', false);" \
  -c "
DO \$\$
DECLARE
  app_user text := current_setting('kizumai.app_user');
  app_pass text := current_setting('kizumai.app_password');
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = app_user) THEN
    EXECUTE format(
      'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
      app_user, app_pass
    );
  ELSE
    EXECUTE format(
      'ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE',
      app_user, app_pass
    );
  END IF;
END
\$\$;
"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO "${POSTGRES_APP_USER}";
GRANT USAGE, CREATE ON SCHEMA public TO "${POSTGRES_APP_USER}";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${POSTGRES_APP_USER}";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "${POSTGRES_APP_USER}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${POSTGRES_APP_USER}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "${POSTGRES_APP_USER}";
EOSQL
