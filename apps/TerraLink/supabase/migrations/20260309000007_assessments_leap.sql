-- ============================================================
-- Migration 006: Assessments / LEAP
--   assessments, assessment_scopes, nature_topics,
--   dependencies, impacts,
--   risk_register, risk_scores,
--   monitoring_rules, monitoring_events
-- ============================================================

-- ── assessments ──────────────────────────────────────────────
create table public.assessments (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces on delete cascade,
  assessment_cycle text not null,
  method_version   text not null,
  status           text not null default 'draft' check (status in (
                     'draft','active','archived')),
  started_at       date,
  closed_at        date,
  created_by       uuid references auth.users,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_asmt_workspace on public.assessments (workspace_id);
create index idx_asmt_status    on public.assessments (status);

select public.apply_updated_at_trigger('assessments');

-- ── assessment_scopes ────────────────────────────────────────
create table public.assessment_scopes (
  id                        uuid primary key default gen_random_uuid(),
  assessment_id             uuid not null references public.assessments on delete cascade,
  scope_type                text not null check (scope_type in (
                              'workspace','organization','site','material','relationship')),
  workspace_organization_id uuid references public.workspace_organizations,
  workspace_site_id         uuid references public.workspace_sites,
  material_id               uuid references public.materials,
  relationship_id           uuid references public.supply_relationships,
  coverage_status           text not null default 'inferred' check (coverage_status in (
                              'inferred','declared','verified')),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index idx_as_assessment on public.assessment_scopes (assessment_id);

select public.apply_updated_at_trigger('assessment_scopes');

-- ── nature_topics ────────────────────────────────────────────
-- Reference / lookup table – seeded, rarely mutated.
create table public.nature_topics (
  id          uuid primary key default gen_random_uuid(),
  topic_key   text unique not null,
  name        text not null,
  topic_group text not null check (topic_group in (
                'land','freshwater','marine','species',
                'pollution','climate_interaction')),
  created_at  timestamptz not null default now()
);

-- ── dependencies ─────────────────────────────────────────────
create table public.dependencies (
  id                   uuid primary key default gen_random_uuid(),
  assessment_scope_id  uuid not null references public.assessment_scopes on delete cascade,
  nature_topic_id      uuid not null references public.nature_topics on delete cascade,
  dependency_level     text not null default 'unknown' check (dependency_level in (
                         'low','medium','high','unknown')),
  rationale            jsonb not null default '{}',
  source_type          text not null default 'manual' check (source_type in (
                         'template','manual','model','external_source')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_dep_scope on public.dependencies (assessment_scope_id);
create index idx_dep_topic on public.dependencies (nature_topic_id);

select public.apply_updated_at_trigger('dependencies');

-- ── impacts ──────────────────────────────────────────────────
create table public.impacts (
  id                   uuid primary key default gen_random_uuid(),
  assessment_scope_id  uuid not null references public.assessment_scopes on delete cascade,
  nature_topic_id      uuid not null references public.nature_topics on delete cascade,
  impact_direction     text not null default 'unknown' check (impact_direction in (
                         'negative','positive','mixed','unknown')),
  impact_level         text not null default 'unknown' check (impact_level in (
                         'low','medium','high','unknown')),
  rationale            jsonb not null default '{}',
  source_type          text not null default 'manual' check (source_type in (
                         'template','manual','model','external_source')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_imp_scope on public.impacts (assessment_scope_id);
create index idx_imp_topic on public.impacts (nature_topic_id);

select public.apply_updated_at_trigger('impacts');

-- ── risk_register ────────────────────────────────────────────
create table public.risk_register (
  id                   uuid primary key default gen_random_uuid(),
  assessment_scope_id  uuid not null references public.assessment_scopes on delete cascade,
  risk_type            text not null check (risk_type in (
                         'physical','transition','systemic',
                         'reputational','legal','market')),
  title                text not null,
  description          text not null,
  status               text not null default 'open' check (status in (
                         'open','accepted','mitigating','closed')),
  owner_user_id        uuid references auth.users,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_rr_scope  on public.risk_register (assessment_scope_id);
create index idx_rr_status on public.risk_register (status);

select public.apply_updated_at_trigger('risk_register');

-- ── risk_scores ──────────────────────────────────────────────
create table public.risk_scores (
  id               uuid primary key default gen_random_uuid(),
  risk_id          uuid not null references public.risk_register on delete cascade,
  severity         numeric(5,2) not null,
  likelihood       numeric(5,2) not null,
  velocity         numeric(5,2),
  detectability    numeric(5,2),
  final_score      numeric(6,2) generated always as (severity * likelihood) stored,
  score_components jsonb not null default '{}',
  scored_at        timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index idx_rs_risk  on public.risk_scores (risk_id);
create index idx_rs_score on public.risk_scores (final_score desc);

-- ── monitoring_rules ─────────────────────────────────────────
create table public.monitoring_rules (
  id          uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  target_type text not null check (target_type in (
                'site','organization','material','relationship')),
  target_id   uuid not null,
  rule_type   text not null check (rule_type in (
                'source_refresh','threshold','missing_evidence','review_due')),
  config      jsonb not null default '{}',
  is_active   boolean not null default true,
  last_run_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_mr_workspace on public.monitoring_rules (workspace_id);
create index idx_mr_target    on public.monitoring_rules (target_type, target_id);
create index idx_mr_active    on public.monitoring_rules (is_active) where is_active = true;

select public.apply_updated_at_trigger('monitoring_rules');

-- ── monitoring_events ────────────────────────────────────────
create table public.monitoring_events (
  id                  uuid primary key default gen_random_uuid(),
  monitoring_rule_id  uuid not null references public.monitoring_rules on delete cascade,
  status              text not null default 'open' check (status in (
                        'open','acknowledged','resolved','ignored')),
  severity            text not null default 'info' check (severity in (
                        'info','warning','critical')),
  title               text not null,
  payload             jsonb not null default '{}',
  triggered_at        timestamptz not null default now(),
  resolved_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index idx_me_rule     on public.monitoring_events (monitoring_rule_id);
create index idx_me_status   on public.monitoring_events (status);
create index idx_me_severity on public.monitoring_events (severity);
