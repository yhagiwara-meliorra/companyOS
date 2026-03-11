-- ============================================================
-- Migration 008: Row Level Security policies
-- ============================================================
-- Strategy:
--   • workspace-scoped tables → is_workspace_member(workspace_id)
--   • organizations / sites   → visible via workspace linkage
--   • supplier org members    → own org data only
--   • change_log              → append-only; read via workspace
--   • reference tables        → authenticated read-only
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- Enable RLS on all tables
-- ═══════════════════════════════════════════════════════════

alter table public.profiles              enable row level security;
alter table public.workspaces            enable row level security;
alter table public.workspace_members     enable row level security;
alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.workspace_organizations enable row level security;
alter table public.sites                 enable row level security;
alter table public.organization_sites    enable row level security;
alter table public.workspace_sites       enable row level security;
alter table public.materials             enable row level security;
alter table public.processes             enable row level security;
alter table public.supply_relationships  enable row level security;
alter table public.supply_edges          enable row level security;
alter table public.supply_edge_materials enable row level security;
alter table public.data_sources          enable row level security;
alter table public.source_versions       enable row level security;
alter table public.ingestion_runs        enable row level security;
alter table public.source_observations   enable row level security;
alter table public.spatial_intersections enable row level security;
alter table public.assessments           enable row level security;
alter table public.assessment_scopes     enable row level security;
alter table public.nature_topics         enable row level security;
alter table public.dependencies          enable row level security;
alter table public.impacts               enable row level security;
alter table public.risk_register         enable row level security;
alter table public.risk_scores           enable row level security;
alter table public.monitoring_rules      enable row level security;
alter table public.monitoring_events     enable row level security;
alter table public.evidence_items        enable row level security;
alter table public.evidence_links        enable row level security;
alter table public.change_log            enable row level security;
alter table public.disclosures           enable row level security;

-- ═══════════════════════════════════════════════════════════
-- profiles — own row only
-- ═══════════════════════════════════════════════════════════

create policy "profiles_select_own"  on public.profiles
  for select using (id = auth.uid());

create policy "profiles_update_own"  on public.profiles
  for update using (id = auth.uid());

-- ═══════════════════════════════════════════════════════════
-- workspaces — members can see their workspaces
-- ═══════════════════════════════════════════════════════════

create policy "workspaces_select" on public.workspaces
  for select using (
    deleted_at is null
    and public.is_workspace_member(id)
  );

create policy "workspaces_insert" on public.workspaces
  for insert with check (true);
  -- Creating a workspace is allowed; the creator must also insert workspace_members.

create policy "workspaces_update" on public.workspaces
  for update using (
    public.has_workspace_role(id, array['owner','admin'])
  );

-- ═══════════════════════════════════════════════════════════
-- workspace_members
-- ═══════════════════════════════════════════════════════════

create policy "wm_select" on public.workspace_members
  for select using (
    public.is_workspace_member(workspace_id)
  );

create policy "wm_insert" on public.workspace_members
  for insert with check (
    -- Allow self-insert (workspace creator) or admin invite
    user_id = auth.uid()
    or public.has_workspace_role(workspace_id, array['owner','admin'])
  );

create policy "wm_update" on public.workspace_members
  for update using (
    public.has_workspace_role(workspace_id, array['owner','admin'])
  );

-- ═══════════════════════════════════════════════════════════
-- organizations — visible through workspace linkage
-- ═══════════════════════════════════════════════════════════

create policy "org_select" on public.organizations
  for select using (
    deleted_at is null
    and (
      -- Visible if linked to a workspace the user belongs to
      exists (
        select 1 from public.workspace_organizations wo
        join public.workspace_members wm on wm.workspace_id = wo.workspace_id
        where wo.organization_id = organizations.id
          and wm.user_id = auth.uid()
          and wm.status = 'active'
      )
      -- Or if the user is a direct org member
      or public.is_org_member(id)
    )
  );

-- Insert/update via service_role only (canonical master merge).
-- Application code uses supabase service client for org create/update.

-- ═══════════════════════════════════════════════════════════
-- organization_members
-- ═══════════════════════════════════════════════════════════

create policy "om_select" on public.organization_members
  for select using (
    public.is_org_member(organization_id)
    or exists (
      select 1 from public.workspace_organizations wo
      join public.workspace_members wm on wm.workspace_id = wo.workspace_id
      where wo.organization_id = organization_members.organization_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
  );

-- ═══════════════════════════════════════════════════════════
-- workspace_organizations
-- ═══════════════════════════════════════════════════════════

create policy "wo_select" on public.workspace_organizations
  for select using (public.is_workspace_member(workspace_id));

create policy "wo_insert" on public.workspace_organizations
  for insert with check (
    public.has_workspace_role(workspace_id, array['owner','admin','analyst'])
  );

create policy "wo_update" on public.workspace_organizations
  for update using (
    public.has_workspace_role(workspace_id, array['owner','admin','analyst'])
  );

-- ═══════════════════════════════════════════════════════════
-- sites — visible through workspace linkage
-- ═══════════════════════════════════════════════════════════

create policy "sites_select" on public.sites
  for select using (
    deleted_at is null
    and (
      exists (
        select 1 from public.workspace_sites ws
        join public.workspace_members wm on wm.workspace_id = ws.workspace_id
        where ws.site_id = sites.id
          and wm.user_id = auth.uid()
          and wm.status = 'active'
      )
      or exists (
        select 1 from public.organization_sites os
        join public.organization_members om on om.organization_id = os.organization_id
        where os.site_id = sites.id
          and om.user_id = auth.uid()
      )
    )
  );

-- ═══════════════════════════════════════════════════════════
-- organization_sites
-- ═══════════════════════════════════════════════════════════

create policy "os_select" on public.organization_sites
  for select using (
    public.is_org_member(organization_id)
    or exists (
      select 1 from public.workspace_sites ws
      join public.workspace_members wm on wm.workspace_id = ws.workspace_id
      where ws.site_id = organization_sites.site_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
  );

-- ═══════════════════════════════════════════════════════════
-- workspace_sites
-- ═══════════════════════════════════════════════════════════

create policy "ws_select" on public.workspace_sites
  for select using (public.is_workspace_member(workspace_id));

create policy "ws_insert" on public.workspace_sites
  for insert with check (
    public.has_workspace_role(workspace_id, array['owner','admin','analyst'])
  );

create policy "ws_update" on public.workspace_sites
  for update using (
    public.has_workspace_role(workspace_id, array['owner','admin','analyst'])
  );

-- ═══════════════════════════════════════════════════════════
-- materials / processes — authenticated read-only (reference data)
-- ═══════════════════════════════════════════════════════════

create policy "materials_select" on public.materials
  for select using (true);

create policy "processes_select" on public.processes
  for select using (true);

-- ═══════════════════════════════════════════════════════════
-- supply_relationships
-- ═══════════════════════════════════════════════════════════

create policy "sr_select" on public.supply_relationships
  for select using (
    deleted_at is null
    and public.is_workspace_member(workspace_id)
  );

create policy "sr_insert" on public.supply_relationships
  for insert with check (
    public.has_workspace_role(workspace_id, array['owner','admin','analyst'])
  );

create policy "sr_update" on public.supply_relationships
  for update using (
    public.has_workspace_role(workspace_id, array['owner','admin','analyst'])
  );

-- ═══════════════════════════════════════════════════════════
-- supply_edges
-- ═══════════════════════════════════════════════════════════

create policy "se_select" on public.supply_edges
  for select using (
    deleted_at is null
    and public.is_workspace_member(workspace_id)
  );

create policy "se_insert" on public.supply_edges
  for insert with check (
    public.has_workspace_role(workspace_id, array['owner','admin','analyst'])
  );

create policy "se_update" on public.supply_edges
  for update using (
    public.has_workspace_role(workspace_id, array['owner','admin','analyst'])
  );

-- ═══════════════════════════════════════════════════════════
-- supply_edge_materials
-- ═══════════════════════════════════════════════════════════

create policy "sem_select" on public.supply_edge_materials
  for select using (
    exists (
      select 1 from public.supply_edges se
      where se.id = supply_edge_materials.supply_edge_id
        and se.deleted_at is null
        and public.is_workspace_member(se.workspace_id)
    )
  );

create policy "sem_insert" on public.supply_edge_materials
  for insert with check (
    exists (
      select 1 from public.supply_edges se
      where se.id = supply_edge_materials.supply_edge_id
        and public.has_workspace_role(se.workspace_id, array['owner','admin','analyst'])
    )
  );

-- ═══════════════════════════════════════════════════════════
-- data_sources / source_versions / ingestion_runs / source_observations
-- Read-only for authenticated users; writes via service_role.
-- ═══════════════════════════════════════════════════════════

create policy "ds_select" on public.data_sources
  for select using (true);

create policy "sv_select" on public.source_versions
  for select using (true);

create policy "ir_select" on public.ingestion_runs
  for select using (true);

create policy "so_select" on public.source_observations
  for select using (true);

-- ═══════════════════════════════════════════════════════════
-- spatial_intersections — workspace-scoped via workspace_sites
-- ═══════════════════════════════════════════════════════════

create policy "si_select" on public.spatial_intersections
  for select using (
    exists (
      select 1 from public.workspace_sites ws
      where ws.id = spatial_intersections.workspace_site_id
        and public.is_workspace_member(ws.workspace_id)
    )
  );

-- ═══════════════════════════════════════════════════════════
-- assessments — workspace-scoped
-- ═══════════════════════════════════════════════════════════

create policy "asmt_select" on public.assessments
  for select using (public.is_workspace_member(workspace_id));

create policy "asmt_insert" on public.assessments
  for insert with check (
    public.has_workspace_role(workspace_id, array['owner','admin','analyst'])
  );

create policy "asmt_update" on public.assessments
  for update using (
    public.has_workspace_role(workspace_id, array['owner','admin','analyst'])
  );

-- ═══════════════════════════════════════════════════════════
-- assessment_scopes — via assessments
-- ═══════════════════════════════════════════════════════════

create policy "as_select" on public.assessment_scopes
  for select using (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_scopes.assessment_id
        and public.is_workspace_member(a.workspace_id)
    )
  );

create policy "as_insert" on public.assessment_scopes
  for insert with check (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_scopes.assessment_id
        and public.has_workspace_role(a.workspace_id, array['owner','admin','analyst'])
    )
  );

-- ═══════════════════════════════════════════════════════════
-- nature_topics — reference, read-only for authenticated
-- ═══════════════════════════════════════════════════════════

create policy "nt_select" on public.nature_topics
  for select using (true);

-- ═══════════════════════════════════════════════════════════
-- dependencies / impacts — via assessment_scopes → assessments
-- ═══════════════════════════════════════════════════════════

create policy "dep_select" on public.dependencies
  for select using (
    exists (
      select 1 from public.assessment_scopes s
      join public.assessments a on a.id = s.assessment_id
      where s.id = dependencies.assessment_scope_id
        and public.is_workspace_member(a.workspace_id)
    )
  );

create policy "dep_insert" on public.dependencies
  for insert with check (
    exists (
      select 1 from public.assessment_scopes s
      join public.assessments a on a.id = s.assessment_id
      where s.id = dependencies.assessment_scope_id
        and public.has_workspace_role(a.workspace_id, array['owner','admin','analyst'])
    )
  );

create policy "imp_select" on public.impacts
  for select using (
    exists (
      select 1 from public.assessment_scopes s
      join public.assessments a on a.id = s.assessment_id
      where s.id = impacts.assessment_scope_id
        and public.is_workspace_member(a.workspace_id)
    )
  );

create policy "imp_insert" on public.impacts
  for insert with check (
    exists (
      select 1 from public.assessment_scopes s
      join public.assessments a on a.id = s.assessment_id
      where s.id = impacts.assessment_scope_id
        and public.has_workspace_role(a.workspace_id, array['owner','admin','analyst'])
    )
  );

-- ═══════════════════════════════════════════════════════════
-- risk_register / risk_scores — via assessment_scopes
-- ═══════════════════════════════════════════════════════════

create policy "rr_select" on public.risk_register
  for select using (
    exists (
      select 1 from public.assessment_scopes s
      join public.assessments a on a.id = s.assessment_id
      where s.id = risk_register.assessment_scope_id
        and public.is_workspace_member(a.workspace_id)
    )
  );

create policy "rr_insert" on public.risk_register
  for insert with check (
    exists (
      select 1 from public.assessment_scopes s
      join public.assessments a on a.id = s.assessment_id
      where s.id = risk_register.assessment_scope_id
        and public.has_workspace_role(a.workspace_id, array['owner','admin','analyst'])
    )
  );

create policy "rr_update" on public.risk_register
  for update using (
    exists (
      select 1 from public.assessment_scopes s
      join public.assessments a on a.id = s.assessment_id
      where s.id = risk_register.assessment_scope_id
        and public.has_workspace_role(a.workspace_id, array['owner','admin','analyst'])
    )
  );

create policy "rs_select" on public.risk_scores
  for select using (
    exists (
      select 1 from public.risk_register rr
      join public.assessment_scopes s on s.id = rr.assessment_scope_id
      join public.assessments a on a.id = s.assessment_id
      where rr.id = risk_scores.risk_id
        and public.is_workspace_member(a.workspace_id)
    )
  );

-- ═══════════════════════════════════════════════════════════
-- monitoring_rules / monitoring_events — workspace-scoped
-- ═══════════════════════════════════════════════════════════

create policy "mr_select" on public.monitoring_rules
  for select using (public.is_workspace_member(workspace_id));

create policy "mr_insert" on public.monitoring_rules
  for insert with check (
    public.has_workspace_role(workspace_id, array['owner','admin','analyst'])
  );

create policy "mr_update" on public.monitoring_rules
  for update using (
    public.has_workspace_role(workspace_id, array['owner','admin','analyst'])
  );

create policy "me_select" on public.monitoring_events
  for select using (
    exists (
      select 1 from public.monitoring_rules mr
      where mr.id = monitoring_events.monitoring_rule_id
        and public.is_workspace_member(mr.workspace_id)
    )
  );

-- ═══════════════════════════════════════════════════════════
-- evidence_items — workspace-scoped with visibility control
-- ═══════════════════════════════════════════════════════════

create policy "ei_select" on public.evidence_items
  for select using (
    deleted_at is null
    and (
      -- Workspace members see workspace_private items
      public.is_workspace_member(workspace_id)
      -- Org members see their org_private items
      or (
        visibility = 'org_private'
        and organization_id is not null
        and public.is_org_member(organization_id)
      )
    )
  );

create policy "ei_insert" on public.evidence_items
  for insert with check (
    public.has_workspace_role(workspace_id,
      array['owner','admin','analyst','reviewer','supplier_manager'])
  );

create policy "ei_update" on public.evidence_items
  for update using (
    public.has_workspace_role(workspace_id,
      array['owner','admin','analyst','reviewer','supplier_manager'])
  );

-- ═══════════════════════════════════════════════════════════
-- evidence_links — via evidence_items
-- ═══════════════════════════════════════════════════════════

create policy "el_select" on public.evidence_links
  for select using (
    exists (
      select 1 from public.evidence_items ei
      where ei.id = evidence_links.evidence_item_id
        and ei.deleted_at is null
        and public.is_workspace_member(ei.workspace_id)
    )
  );

create policy "el_insert" on public.evidence_links
  for insert with check (
    exists (
      select 1 from public.evidence_items ei
      where ei.id = evidence_links.evidence_item_id
        and public.has_workspace_role(ei.workspace_id,
          array['owner','admin','analyst','reviewer','supplier_manager'])
    )
  );

-- ═══════════════════════════════════════════════════════════
-- change_log — append-only; read via workspace membership
-- ═══════════════════════════════════════════════════════════

create policy "cl_select" on public.change_log
  for select using (public.is_workspace_member(workspace_id));

-- Insert allowed for any active workspace member (app writes logs).
create policy "cl_insert" on public.change_log
  for insert with check (
    public.is_workspace_member(workspace_id)
  );

-- No update/delete policies — append-only by design.

-- ═══════════════════════════════════════════════════════════
-- disclosures — workspace-scoped
-- ═══════════════════════════════════════════════════════════

create policy "disc_select" on public.disclosures
  for select using (public.is_workspace_member(workspace_id));

create policy "disc_insert" on public.disclosures
  for insert with check (
    public.has_workspace_role(workspace_id, array['owner','admin','analyst'])
  );

create policy "disc_update" on public.disclosures
  for update using (
    public.has_workspace_role(workspace_id, array['owner','admin','analyst'])
  );
