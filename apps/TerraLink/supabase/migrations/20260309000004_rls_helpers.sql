-- ============================================================
-- Migration 003b: RLS helper functions
-- (workspace_members / organization_members に依存するため
--  テーブル作成 003 の後に実行する)
-- ============================================================

-- ── workspace membership checker ─────────────────────────────
create or replace function public.is_workspace_member(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$ language sql security definer stable;

-- ── workspace membership with minimum role ───────────────────
create or replace function public.has_workspace_role(
  ws_id uuid,
  min_roles text[]
)
returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id
      and user_id = auth.uid()
      and status = 'active'
      and role = any(min_roles)
  );
$$ language sql security definer stable;

-- ── organization membership checker ──────────────────────────
create or replace function public.is_org_member(org_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
  );
$$ language sql security definer stable;
