-- ============================================================
-- Migration: EUDR RLS Policies & CHECK Constraint Extensions
-- ============================================================

-- ── Extend existing CHECK constraints ───────────────────────

-- evidence_items.evidence_type: add EUDR-specific types
alter table public.evidence_items
  drop constraint if exists evidence_items_evidence_type_check;
alter table public.evidence_items
  add constraint evidence_items_evidence_type_check
  check (evidence_type in (
    'invoice','certificate','survey','report',
    'map','contract','screenshot','other',
    'legality_proof','deforestation_free_proof','dds_export'
  ));

-- evidence_links.target_type: add EUDR target types
alter table public.evidence_links
  drop constraint if exists evidence_links_target_type_check;
alter table public.evidence_links
  add constraint evidence_links_target_type_check
  check (target_type in (
    'workspace_org','site','relationship',
    'assessment','risk','monitoring_event',
    'dds_statement','eudr_risk_assessment','dds_plot'
  ));

-- change_log.action: add EUDR actions
alter table public.change_log
  drop constraint if exists change_log_action_check;
alter table public.change_log
  add constraint change_log_action_check
  check (action in (
    'insert','update','delete','status_change','share','unshare',
    'trigger_ingestion','run_sample_ingestion','soft_delete',
    'dds_submit','dds_withdraw','dds_export'
  ));

-- ── RLS: Reference tables (read-only for authenticated) ─────

alter table public.eudr_commodity_codes enable row level security;
create policy "eudr_commodity_codes_read"
  on public.eudr_commodity_codes for select
  to authenticated
  using (true);

alter table public.eudr_country_benchmarks enable row level security;
create policy "eudr_country_benchmarks_read"
  on public.eudr_country_benchmarks for select
  to authenticated
  using (true);

-- ── RLS: DDS Statements ─────────────────────────────────────

alter table public.eudr_dds_statements enable row level security;

create policy "eudr_dds_statements_select"
  on public.eudr_dds_statements for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "eudr_dds_statements_insert"
  on public.eudr_dds_statements for insert
  to authenticated
  with check (public.has_workspace_role(workspace_id, array['owner','admin','analyst']));

create policy "eudr_dds_statements_update"
  on public.eudr_dds_statements for update
  to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin','analyst']));

-- ── RLS: DDS Product Lines ──────────────────────────────────

alter table public.eudr_dds_product_lines enable row level security;

create policy "eudr_dds_product_lines_select"
  on public.eudr_dds_product_lines for select
  to authenticated
  using (exists (
    select 1 from public.eudr_dds_statements s
    where s.id = dds_id and public.is_workspace_member(s.workspace_id)
  ));

create policy "eudr_dds_product_lines_insert"
  on public.eudr_dds_product_lines for insert
  to authenticated
  with check (exists (
    select 1 from public.eudr_dds_statements s
    where s.id = dds_id and public.has_workspace_role(s.workspace_id, array['owner','admin','analyst'])
  ));

create policy "eudr_dds_product_lines_update"
  on public.eudr_dds_product_lines for update
  to authenticated
  using (exists (
    select 1 from public.eudr_dds_statements s
    where s.id = dds_id and public.has_workspace_role(s.workspace_id, array['owner','admin','analyst'])
  ));

-- ── RLS: DDS Plots ──────────────────────────────────────────

alter table public.eudr_dds_plots enable row level security;

create policy "eudr_dds_plots_select"
  on public.eudr_dds_plots for select
  to authenticated
  using (exists (
    select 1 from public.eudr_dds_product_lines pl
    join public.eudr_dds_statements s on s.id = pl.dds_id
    where pl.id = product_line_id and public.is_workspace_member(s.workspace_id)
  ));

create policy "eudr_dds_plots_insert"
  on public.eudr_dds_plots for insert
  to authenticated
  with check (exists (
    select 1 from public.eudr_dds_product_lines pl
    join public.eudr_dds_statements s on s.id = pl.dds_id
    where pl.id = product_line_id and public.has_workspace_role(s.workspace_id, array['owner','admin','analyst'])
  ));

create policy "eudr_dds_plots_update"
  on public.eudr_dds_plots for update
  to authenticated
  using (exists (
    select 1 from public.eudr_dds_product_lines pl
    join public.eudr_dds_statements s on s.id = pl.dds_id
    where pl.id = product_line_id and public.has_workspace_role(s.workspace_id, array['owner','admin','analyst'])
  ));

-- ── RLS: Upstream Refs ──────────────────────────────────────

alter table public.eudr_dds_upstream_refs enable row level security;

create policy "eudr_dds_upstream_refs_select"
  on public.eudr_dds_upstream_refs for select
  to authenticated
  using (exists (
    select 1 from public.eudr_dds_statements s
    where s.id = dds_id and public.is_workspace_member(s.workspace_id)
  ));

create policy "eudr_dds_upstream_refs_insert"
  on public.eudr_dds_upstream_refs for insert
  to authenticated
  with check (exists (
    select 1 from public.eudr_dds_statements s
    where s.id = dds_id and public.has_workspace_role(s.workspace_id, array['owner','admin','analyst'])
  ));

-- ── RLS: Cattle Animals ─────────────────────────────────────

alter table public.eudr_dds_cattle_animals enable row level security;

create policy "eudr_dds_cattle_animals_select"
  on public.eudr_dds_cattle_animals for select
  to authenticated
  using (exists (
    select 1 from public.eudr_dds_product_lines pl
    join public.eudr_dds_statements s on s.id = pl.dds_id
    where pl.id = product_line_id and public.is_workspace_member(s.workspace_id)
  ));

create policy "eudr_dds_cattle_animals_insert"
  on public.eudr_dds_cattle_animals for insert
  to authenticated
  with check (exists (
    select 1 from public.eudr_dds_product_lines pl
    join public.eudr_dds_statements s on s.id = pl.dds_id
    where pl.id = product_line_id and public.has_workspace_role(s.workspace_id, array['owner','admin','analyst'])
  ));

-- ── RLS: Cattle Establishments ──────────────────────────────

alter table public.eudr_dds_cattle_establishments enable row level security;

create policy "eudr_dds_cattle_establishments_select"
  on public.eudr_dds_cattle_establishments for select
  to authenticated
  using (exists (
    select 1 from public.eudr_dds_cattle_animals ca
    join public.eudr_dds_product_lines pl on pl.id = ca.product_line_id
    join public.eudr_dds_statements s on s.id = pl.dds_id
    where ca.id = cattle_animal_id and public.is_workspace_member(s.workspace_id)
  ));

create policy "eudr_dds_cattle_establishments_insert"
  on public.eudr_dds_cattle_establishments for insert
  to authenticated
  with check (exists (
    select 1 from public.eudr_dds_cattle_animals ca
    join public.eudr_dds_product_lines pl on pl.id = ca.product_line_id
    join public.eudr_dds_statements s on s.id = pl.dds_id
    where ca.id = cattle_animal_id and public.has_workspace_role(s.workspace_id, array['owner','admin','analyst'])
  ));

-- ── RLS: Risk Assessments ───────────────────────────────────

alter table public.eudr_risk_assessments enable row level security;

create policy "eudr_risk_assessments_select"
  on public.eudr_risk_assessments for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "eudr_risk_assessments_insert"
  on public.eudr_risk_assessments for insert
  to authenticated
  with check (public.has_workspace_role(workspace_id, array['owner','admin','analyst']));

create policy "eudr_risk_assessments_update"
  on public.eudr_risk_assessments for update
  to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin','analyst']));

-- ── RLS: Risk Criteria ──────────────────────────────────────

alter table public.eudr_risk_criteria enable row level security;

create policy "eudr_risk_criteria_select"
  on public.eudr_risk_criteria for select
  to authenticated
  using (exists (
    select 1 from public.eudr_risk_assessments ra
    where ra.id = risk_assessment_id and public.is_workspace_member(ra.workspace_id)
  ));

create policy "eudr_risk_criteria_insert"
  on public.eudr_risk_criteria for insert
  to authenticated
  with check (exists (
    select 1 from public.eudr_risk_assessments ra
    where ra.id = risk_assessment_id and public.has_workspace_role(ra.workspace_id, array['owner','admin','analyst'])
  ));

create policy "eudr_risk_criteria_update"
  on public.eudr_risk_criteria for update
  to authenticated
  using (exists (
    select 1 from public.eudr_risk_assessments ra
    where ra.id = risk_assessment_id and public.has_workspace_role(ra.workspace_id, array['owner','admin','analyst'])
  ));

-- ── RLS: Risk Mitigations ───────────────────────────────────

alter table public.eudr_risk_mitigations enable row level security;

create policy "eudr_risk_mitigations_select"
  on public.eudr_risk_mitigations for select
  to authenticated
  using (exists (
    select 1 from public.eudr_risk_assessments ra
    where ra.id = risk_assessment_id and public.is_workspace_member(ra.workspace_id)
  ));

create policy "eudr_risk_mitigations_insert"
  on public.eudr_risk_mitigations for insert
  to authenticated
  with check (exists (
    select 1 from public.eudr_risk_assessments ra
    where ra.id = risk_assessment_id and public.has_workspace_role(ra.workspace_id, array['owner','admin','analyst'])
  ));

create policy "eudr_risk_mitigations_update"
  on public.eudr_risk_mitigations for update
  to authenticated
  using (exists (
    select 1 from public.eudr_risk_assessments ra
    where ra.id = risk_assessment_id and public.has_workspace_role(ra.workspace_id, array['owner','admin','analyst'])
  ));

-- ── RLS: Exports ────────────────────────────────────────────

alter table public.eudr_exports enable row level security;

create policy "eudr_exports_select"
  on public.eudr_exports for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "eudr_exports_insert"
  on public.eudr_exports for insert
  to authenticated
  with check (public.has_workspace_role(workspace_id, array['owner','admin','analyst']));
