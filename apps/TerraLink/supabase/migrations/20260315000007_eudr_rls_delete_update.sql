-- ============================================================
-- Migration: EUDR RLS — Missing UPDATE & DELETE Policies
--   Adds DELETE policies for 9 EUDR tables and UPDATE policies
--   for 4 tables that were missing them.
-- ============================================================

-- ── UPDATE policies (missing tables) ─────────────────────────

-- upstream_refs: join to statements via dds_id
create policy "eudr_dds_upstream_refs_update"
  on public.eudr_dds_upstream_refs for update
  to authenticated
  using (exists (
    select 1 from public.eudr_dds_statements s
    where s.id = dds_id
      and public.has_workspace_role(s.workspace_id, array['owner','admin','analyst'])
  ));

-- cattle_animals: join through product_lines → statements
create policy "eudr_dds_cattle_animals_update"
  on public.eudr_dds_cattle_animals for update
  to authenticated
  using (exists (
    select 1 from public.eudr_dds_product_lines pl
    join public.eudr_dds_statements s on s.id = pl.dds_id
    where pl.id = product_line_id
      and public.has_workspace_role(s.workspace_id, array['owner','admin','analyst'])
  ));

-- cattle_establishments: join through cattle_animals → product_lines → statements
create policy "eudr_dds_cattle_establishments_update"
  on public.eudr_dds_cattle_establishments for update
  to authenticated
  using (exists (
    select 1 from public.eudr_dds_cattle_animals ca
    join public.eudr_dds_product_lines pl on pl.id = ca.product_line_id
    join public.eudr_dds_statements s on s.id = pl.dds_id
    where ca.id = cattle_animal_id
      and public.has_workspace_role(s.workspace_id, array['owner','admin','analyst'])
  ));

-- exports: direct workspace_id (owner/admin only)
create policy "eudr_exports_update"
  on public.eudr_exports for update
  to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin']));

-- ── DELETE policies ──────────────────────────────────────────

-- DDS Statements: direct workspace_id
create policy "eudr_dds_statements_delete"
  on public.eudr_dds_statements for delete
  to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin','analyst']));

-- Product Lines: join to statements via dds_id
create policy "eudr_dds_product_lines_delete"
  on public.eudr_dds_product_lines for delete
  to authenticated
  using (exists (
    select 1 from public.eudr_dds_statements s
    where s.id = dds_id
      and public.has_workspace_role(s.workspace_id, array['owner','admin','analyst'])
  ));

-- Plots: join through product_lines → statements
create policy "eudr_dds_plots_delete"
  on public.eudr_dds_plots for delete
  to authenticated
  using (exists (
    select 1 from public.eudr_dds_product_lines pl
    join public.eudr_dds_statements s on s.id = pl.dds_id
    where pl.id = product_line_id
      and public.has_workspace_role(s.workspace_id, array['owner','admin','analyst'])
  ));

-- Upstream Refs: join to statements via dds_id
create policy "eudr_dds_upstream_refs_delete"
  on public.eudr_dds_upstream_refs for delete
  to authenticated
  using (exists (
    select 1 from public.eudr_dds_statements s
    where s.id = dds_id
      and public.has_workspace_role(s.workspace_id, array['owner','admin','analyst'])
  ));

-- Cattle Animals: join through product_lines → statements
create policy "eudr_dds_cattle_animals_delete"
  on public.eudr_dds_cattle_animals for delete
  to authenticated
  using (exists (
    select 1 from public.eudr_dds_product_lines pl
    join public.eudr_dds_statements s on s.id = pl.dds_id
    where pl.id = product_line_id
      and public.has_workspace_role(s.workspace_id, array['owner','admin','analyst'])
  ));

-- Cattle Establishments: join through cattle_animals → product_lines → statements
create policy "eudr_dds_cattle_establishments_delete"
  on public.eudr_dds_cattle_establishments for delete
  to authenticated
  using (exists (
    select 1 from public.eudr_dds_cattle_animals ca
    join public.eudr_dds_product_lines pl on pl.id = ca.product_line_id
    join public.eudr_dds_statements s on s.id = pl.dds_id
    where ca.id = cattle_animal_id
      and public.has_workspace_role(s.workspace_id, array['owner','admin','analyst'])
  ));

-- Risk Assessments: direct workspace_id
create policy "eudr_risk_assessments_delete"
  on public.eudr_risk_assessments for delete
  to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin','analyst']));

-- Risk Criteria: join to risk_assessments
create policy "eudr_risk_criteria_delete"
  on public.eudr_risk_criteria for delete
  to authenticated
  using (exists (
    select 1 from public.eudr_risk_assessments ra
    where ra.id = risk_assessment_id
      and public.has_workspace_role(ra.workspace_id, array['owner','admin','analyst'])
  ));

-- Risk Mitigations: join to risk_assessments
create policy "eudr_risk_mitigations_delete"
  on public.eudr_risk_mitigations for delete
  to authenticated
  using (exists (
    select 1 from public.eudr_risk_assessments ra
    where ra.id = risk_assessment_id
      and public.has_workspace_role(ra.workspace_id, array['owner','admin','analyst'])
  ));

-- NOTE: No DELETE policies for reference tables (eudr_commodity_codes,
-- eudr_country_benchmarks) or audit trail (eudr_exports).
