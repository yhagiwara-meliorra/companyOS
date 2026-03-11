-- ============================================================
-- Migration: Supplier Portal RLS policies
-- Adds write / update policies so that organization members
-- (suppliers) can self-service through the RLS-enforced client
-- rather than relying solely on the service_role admin client.
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- Helper: has_org_role — checks user has one of min_roles
-- in the given organization
-- ═══════════════════════════════════════════════════════════

create or replace function public.has_org_role(
  org_id uuid,
  min_roles text[]
)
returns boolean as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and role = any(min_roles)
  );
$$ language sql security definer stable;


-- ═══════════════════════════════════════════════════════════
-- organizations — org_owner / org_admin can UPDATE own org
-- (INSERT remains service_role only for canonical merge)
-- ═══════════════════════════════════════════════════════════

create policy "org_update_by_org_admin"
  on public.organizations for update
  using (
    deleted_at is null
    and public.has_org_role(id, array['org_owner','org_admin'])
  );


-- ═══════════════════════════════════════════════════════════
-- organization_members — org_owner can manage members
-- ═══════════════════════════════════════════════════════════

create policy "om_insert_by_org_owner"
  on public.organization_members for insert
  with check (
    public.has_org_role(organization_id, array['org_owner'])
  );

create policy "om_update_by_org_owner"
  on public.organization_members for update
  using (
    public.has_org_role(organization_id, array['org_owner'])
  );


-- ═══════════════════════════════════════════════════════════
-- sites — org members can INSERT new sites
-- (sites themselves are shared; ownership tracked via org_sites)
-- ═══════════════════════════════════════════════════════════

create policy "sites_insert_by_org_member"
  on public.sites for insert
  with check (
    -- Any authenticated user can create a site.
    -- Ownership is established through organization_sites link.
    auth.uid() is not null
  );

create policy "sites_update_by_org_member"
  on public.sites for update
  using (
    -- Org owners / admins can update sites linked to their org
    exists (
      select 1 from public.organization_sites os
      where os.site_id = sites.id
        and public.has_org_role(os.organization_id, array['org_owner','org_admin'])
    )
  );


-- ═══════════════════════════════════════════════════════════
-- organization_sites — org members can link sites to their org
-- ═══════════════════════════════════════════════════════════

create policy "os_insert_by_org_member"
  on public.organization_sites for insert
  with check (
    public.has_org_role(organization_id, array['org_owner','org_admin','contributor'])
  );

create policy "os_update_by_org_admin"
  on public.organization_sites for update
  using (
    public.has_org_role(organization_id, array['org_owner','org_admin'])
  );


-- ═══════════════════════════════════════════════════════════
-- workspace_organizations — suppliers can READ their own
-- invitations / linkages (to see which buyers invited them)
-- ═══════════════════════════════════════════════════════════

create policy "wo_select_by_org_member"
  on public.workspace_organizations for select
  using (
    public.is_org_member(organization_id)
  );


-- ═══════════════════════════════════════════════════════════
-- evidence_items — supplier org members can:
--   • READ evidence shared with buyers (shared_to_buyers)
--   • INSERT org_private evidence
-- ═══════════════════════════════════════════════════════════

-- Allow org members to see shared_to_buyers evidence for their org.
-- (The existing ei_select covers workspace_private + org_private;
--  this adds the shared_to_buyers case.)
create policy "ei_select_shared_to_buyers"
  on public.evidence_items for select
  using (
    deleted_at is null
    and visibility = 'shared_to_buyers'
    and organization_id is not null
    and public.is_org_member(organization_id)
  );

-- Allow org members to upload org_private evidence for their org.
create policy "ei_insert_by_org_member"
  on public.evidence_items for insert
  with check (
    visibility = 'org_private'
    and organization_id is not null
    and public.has_org_role(organization_id, array['org_owner','org_admin','contributor'])
  );

-- Allow org members to update their own org_private evidence metadata.
create policy "ei_update_by_org_member"
  on public.evidence_items for update
  using (
    visibility = 'org_private'
    and organization_id is not null
    and public.has_org_role(organization_id, array['org_owner','org_admin'])
  );


-- ═══════════════════════════════════════════════════════════
-- Supabase Realtime — enable publication for dashboard tables
-- Needed for live dashboard updates
-- ═══════════════════════════════════════════════════════════

-- Create publication for realtime if it doesn't exist.
-- (Supabase creates 'supabase_realtime' by default.)
-- We add specific tables for filtered broadcasts.
alter publication supabase_realtime add table public.monitoring_events;
alter publication supabase_realtime add table public.change_log;
alter publication supabase_realtime add table public.monitoring_rules;
