-- Executed once on first boot of the postgres container (empty PGDATA).
-- Extensions required by PRIME migrations.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- RLS policies are created per-table via Prisma migrations. These helper
-- functions support the RLS session variable pattern (design doc 7.6).
-- The runtime role (`prime_app`) is provisioned by init.sh (password comes
-- from POSTGRES_APP_PASSWORD so it matches pgbouncer's generated userlist).
CREATE OR REPLACE FUNCTION set_app_current_user(user_id text)
RETURNS void LANGUAGE sql
AS $$
  SELECT set_config('app.current_user_id', user_id, true);
$$;