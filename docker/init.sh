#!/bin/sh
# Provision the application role used by every API connection.
#
# RLS is FORCEd on all user-owned tables, so the app role MUST NOT be a
# superuser nor the table owner and MUST NOT have BYPASSRLS - otherwise the
# isolation policies in migrations/20260919120000_rls_user_isolation would
# be silently skipped (design doc 7.6 / DB-09).
#
# Runs via /docker-entrypoint-initdb.d/ on the first boot of an empty data
# directory. Idempotent.
set -e

APP_PASSWORD="${POSTGRES_APP_PASSWORD:-prime_app_password}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'prime_app') THEN
    CREATE ROLE prime_app LOGIN PASSWORD '${APP_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
\$\$;

GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO prime_app;
GRANT USAGE ON SCHEMA public TO prime_app;

-- Cover tables/sequences created afterwards by `prisma migrate deploy`.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO prime_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO prime_app;
EOSQL