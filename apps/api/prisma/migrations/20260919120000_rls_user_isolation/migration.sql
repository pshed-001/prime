-- Row-Level Security (design §7.6, DB-09). Column names match Prisma
-- (camelCase "userId"), not snake_case. FORCE is required so the table-owning
-- API role is still subject to the policy.

CREATE OR REPLACE FUNCTION prime_current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.current_user_id', true)
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_settings',
    'tasks',
    'expenses',
    'assets',
    'reports',
    'sync_queue',
    'audit_logs',
    'exchange_rate_snapshots',
    'tombstones'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_user_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING ("userId" = prime_current_user_id()) WITH CHECK ("userId" = prime_current_user_id())',
      t || '_user_isolation',
      t
    );
  END LOOP;
END
$$;
