-- ============================================================
-- Migration: EUDR Risk Assessment & Export Tables
--   eudr_risk_assessments, eudr_risk_criteria,
--   eudr_risk_mitigations, eudr_exports
-- ============================================================

-- ── eudr_risk_assessments ───────────────────────────────────
-- One risk assessment per DDS statement
create table public.eudr_risk_assessments (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references public.workspaces on delete cascade,
  dds_id                  uuid not null references public.eudr_dds_statements on delete cascade,
  overall_result          text not null default 'pending' check (overall_result in (
                            'pending','negligible','non_negligible')),
  country_risk_level      text check (country_risk_level in ('low','standard','high')),
  auto_score_json         jsonb not null default '{}',
  manual_override         boolean not null default false,
  assessed_by             uuid references auth.users,
  assessed_at             timestamptz,
  rationale               text,
  status                  text not null default 'draft' check (status in (
                            'draft','in_review','completed')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (dds_id)
);

create index idx_era_workspace on public.eudr_risk_assessments (workspace_id);
create index idx_era_dds       on public.eudr_risk_assessments (dds_id);
create index idx_era_result    on public.eudr_risk_assessments (overall_result);
create index idx_era_status    on public.eudr_risk_assessments (status);

select public.apply_updated_at_trigger('eudr_risk_assessments');

-- ── eudr_risk_criteria ──────────────────────────────────────
-- Individual risk criterion scores (14 criteria from EUDR Art. 10)
-- criterion_key: 'a' through 'n' per the regulation
create table public.eudr_risk_criteria (
  id                      uuid primary key default gen_random_uuid(),
  risk_assessment_id      uuid not null references public.eudr_risk_assessments on delete cascade,
  criterion_key           text not null,
  criterion_label         text not null,
  auto_score              text check (auto_score in ('low','medium','high')),
  manual_override         text check (manual_override in ('low','medium','high')),
  final_score             text check (final_score in ('low','medium','high')),
  evidence_notes          text,
  evidence_item_ids       uuid[] not null default '{}',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (risk_assessment_id, criterion_key)
);

create index idx_erc_assessment on public.eudr_risk_criteria (risk_assessment_id);
create index idx_erc_key        on public.eudr_risk_criteria (criterion_key);

select public.apply_updated_at_trigger('eudr_risk_criteria');

-- ── eudr_risk_mitigations ───────────────────────────────────
-- Risk mitigation measures recorded after non-negligible assessment
create table public.eudr_risk_mitigations (
  id                      uuid primary key default gen_random_uuid(),
  risk_assessment_id      uuid not null references public.eudr_risk_assessments on delete cascade,
  criterion_key           text,
  mitigation_type         text not null,
  description             text not null,
  evidence_item_id        uuid references public.evidence_items,
  status                  text not null default 'planned' check (status in (
                            'planned','in_progress','completed','verified')),
  completed_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_erm_assessment on public.eudr_risk_mitigations (risk_assessment_id);
create index idx_erm_status     on public.eudr_risk_mitigations (status);

select public.apply_updated_at_trigger('eudr_risk_mitigations');

-- ── eudr_exports ────────────────────────────────────────────
-- Audit log for DDS exports (JSON, CSV, evidence pack)
create table public.eudr_exports (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references public.workspaces on delete cascade,
  dds_id                  uuid not null references public.eudr_dds_statements on delete cascade,
  export_type             text not null check (export_type in (
                            'dds_json','dds_csv','evidence_pack','traces_payload')),
  file_name               text,
  storage_path            text,
  payload_snapshot        jsonb,
  exported_by             uuid references auth.users,
  created_at              timestamptz not null default now()
);

create index idx_ee_workspace on public.eudr_exports (workspace_id);
create index idx_ee_dds       on public.eudr_exports (dds_id);
create index idx_ee_type      on public.eudr_exports (export_type);
