-- ============================================================
-- Seed data for local development
-- Run with: npx supabase db reset
-- ============================================================

-- Note: User/profile creation is handled by Supabase Auth.
-- After running `npx supabase db reset`, sign up via the UI
-- and then use the SQL below to set up sample data.

-- ── Sample workspace ────────────────────────────────────────
-- Use this after creating a user account. Replace the UUID
-- with your auth.users.id from the Supabase dashboard.

-- INSERT INTO public.workspaces (id, name, slug, plan)
-- VALUES (
--   'a0000000-0000-0000-0000-000000000001',
--   'Demo Workspace',
--   'demo',
--   'pro'
-- );

-- INSERT INTO public.workspace_members (workspace_id, user_id, role)
-- VALUES (
--   'a0000000-0000-0000-0000-000000000001',
--   '<YOUR_USER_ID>',          -- Replace with your user ID
--   'owner'
-- );

-- ── Sample organizations ────────────────────────────────────

-- INSERT INTO public.organizations (id, org_name, country, verification_status)
-- VALUES
--   ('b0000000-0000-0000-0000-000000000001', 'Acme Manufacturing Co.', 'JP', 'declared'),
--   ('b0000000-0000-0000-0000-000000000002', 'Green Valley Farms', 'TH', 'verified'),
--   ('b0000000-0000-0000-0000-000000000003', 'Pacific Timber Ltd.', 'ID', 'inferred');

-- INSERT INTO public.workspace_organizations (workspace_id, organization_id, is_buyer)
-- VALUES
--   ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', true),
--   ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', false),
--   ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', false);

-- ── Sample sites (PostGIS) ──────────────────────────────────

-- INSERT INTO public.sites (id, site_name, country, site_type, location, verification_status)
-- VALUES
--   ('c0000000-0000-0000-0000-000000000001', 'Tokyo Head Office', 'JP', 'office',
--    ST_SetSRID(ST_MakePoint(139.7671, 35.6812), 4326)::geography, 'declared'),
--   ('c0000000-0000-0000-0000-000000000002', 'Chiang Mai Farm', 'TH', 'farm',
--    ST_SetSRID(ST_MakePoint(98.9853, 18.7883), 4326)::geography, 'verified'),
--   ('c0000000-0000-0000-0000-000000000003', 'Kalimantan Plantation', 'ID', 'plantation',
--    ST_SetSRID(ST_MakePoint(116.0418, -1.6817), 4326)::geography, 'inferred');

-- INSERT INTO public.workspace_sites (workspace_id, site_id, organization_id)
-- VALUES
--   ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'),
--   ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002'),
--   ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003');

-- ── Seed instructions ───────────────────────────────────────
-- 1. Run `npx supabase db reset` to apply migrations + this seed
-- 2. Sign up a user at http://localhost:3000/login
-- 3. Uncomment and run the INSERTs above in the Supabase SQL editor
--    (replace <YOUR_USER_ID> with your auth.users.id)
-- 4. The app will show sample data in the Demo workspace
