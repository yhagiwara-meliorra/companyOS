-- ============================================================
-- Migration 011: Expand profiles RLS
-- Allow workspace members to see each other's profiles.
-- ============================================================

-- Drop the original restrictive policy
drop policy if exists "profiles_select_own" on public.profiles;

-- Allow users to see profiles of people they share a workspace with
create policy "profiles_select_shared" on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.workspace_members my_wm
      join public.workspace_members their_wm
        on their_wm.workspace_id = my_wm.workspace_id
      where my_wm.user_id = auth.uid()
        and my_wm.status = 'active'
        and their_wm.user_id = profiles.id
    )
  );
