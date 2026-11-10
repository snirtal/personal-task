-- Personal Task: let the Data API authenticated role call auth.uid().
-- This file has not been applied. Run it only in neon-cordovan-zebra, after approval.
-- It does not change RLS policies, table grants, or Neon Auth tables.

BEGIN;

GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

COMMIT;
