-- Row-Level Security (RLS) — defense-in-depth tenant isolation.
-- Run this ONCE in the Supabase SQL editor, AFTER init.sql.
--
-- The app already filters every query by tenant_id at the application layer.
-- RLS is the safety net underneath: even a query that forgets its WHERE clause
-- cannot read or write another tenant's rows, because the database refuses.
--
-- How the app cooperates: the backend sets a transaction-local GUC
-- `app.tenant_id` (via set_config(..., true)) at the start of every transaction
-- (see backend/app/core/database.py). The policies below compare each row's
-- tenant_id against that GUC.

-- 1. Enable + FORCE RLS on both tables.
--    FORCE is required so the policies apply even to the table OWNER — the role
--    the app connects as. Without FORCE, the owner silently bypasses RLS.
ALTER TABLE documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents       FORCE  ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks FORCE  ROW LEVEL SECURITY;

-- 2. Policies: a row is visible/writable only when its tenant_id matches the
--    current transaction's app.tenant_id GUC.
--    current_setting(..., true) returns NULL when the GUC is unset, so a query
--    that never bound a tenant sees NO rows and can INSERT nothing (fail closed).
DROP POLICY IF EXISTS tenant_isolation ON documents;
CREATE POLICY tenant_isolation ON documents
    FOR ALL
    USING      (tenant_id = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tenant_isolation ON document_chunks;
CREATE POLICY tenant_isolation ON document_chunks
    FOR ALL
    USING      (tenant_id = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- 3. VERIFY that RLS will actually apply to your app's DB role.
--    RLS is silently bypassed by SUPERUSER roles and roles with BYPASSRLS.
--    Your connection role must show false in BOTH columns:
--
--        SELECT rolname, rolsuper, rolbypassrls
--        FROM pg_roles WHERE rolname = current_user;
--
--    Functional check (run as the app's role, e.g. via the same DATABASE_URL):
--
--        SELECT set_config('app.tenant_id', 'tenant-A', true);
--        SELECT count(*) FROM documents;          -- only tenant-A's rows
--        SELECT set_config('app.tenant_id', 'nope', true);
--        SELECT count(*) FROM documents;          -- expect 0
--
--    If the counts are NOT isolated, your role bypasses RLS. The strongest fix is
--    a dedicated, unprivileged role that owns nothing:
--
--        CREATE ROLE sage_app LOGIN PASSWORD '...' NOSUPERUSER NOBYPASSRLS;
--        GRANT SELECT, INSERT, UPDATE, DELETE ON documents, document_chunks TO sage_app;
--
--    then point DATABASE_URL at sage_app. (FORCE RLS above already covers the
--    owner case; a dedicated non-owner role is the belt-and-suspenders option.)
