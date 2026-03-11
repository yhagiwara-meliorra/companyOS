-- ============================================================
-- Migration 007: Evidence / audit
--   evidence_items, evidence_links, change_log, disclosures
-- ============================================================

-- ── evidence_items ───────────────────────────────────────────
create table public.evidence_items (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces on delete cascade,
  organization_id uuid references public.organizations,
  site_id         uuid references public.sites,
  storage_bucket  text not null,
  storage_path    text not null,
  file_name       text not null,
  mime_type       text not null,
  file_size_bytes bigint not null,
  sha256          text,
  evidence_type   text not null check (evidence_type in (
                    'invoice','certificate','survey','report',
                    'map','contract','screenshot','other')),
  visibility      text not null default 'workspace_private' check (visibility in (
                    'workspace_private','shared_to_buyers','org_private')),
  uploaded_by     uuid references auth.users,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index idx_ei_workspace on public.evidence_items (workspace_id) where deleted_at is null;
create index idx_ei_org       on public.evidence_items (organization_id) where deleted_at is null;
create index idx_ei_site      on public.evidence_items (site_id) where deleted_at is null;
create index idx_ei_type      on public.evidence_items (evidence_type);

select public.apply_updated_at_trigger('evidence_items');

-- ── evidence_links ───────────────────────────────────────────
create table public.evidence_links (
  id                uuid primary key default gen_random_uuid(),
  evidence_item_id  uuid not null references public.evidence_items on delete cascade,
  target_type       text not null check (target_type in (
                      'workspace_org','site','relationship',
                      'assessment','risk','monitoring_event')),
  target_id         uuid not null,
  note              text,
  linked_at         timestamptz not null default now()
);

create index idx_el_evidence on public.evidence_links (evidence_item_id);
create index idx_el_target   on public.evidence_links (target_type, target_id);

-- ── change_log ───────────────────────────────────────────────
-- Append-only audit table — no UPDATE or DELETE should ever run on this.
create table public.change_log (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces on delete cascade,
  actor_user_id uuid references auth.users,
  target_table  text not null,
  target_id     uuid not null,
  action        text not null check (action in (
                  'insert','update','delete','status_change','share','unshare')),
  before_state  jsonb,
  after_state   jsonb,
  created_at    timestamptz not null default now()
);

-- Time-series index for recent-first queries
create index idx_cl_workspace on public.change_log (workspace_id, created_at desc);
create index idx_cl_target    on public.change_log (target_table, target_id);
create index idx_cl_actor     on public.change_log (actor_user_id);

-- ── disclosures ──────────────────────────────────────────────
create table public.disclosures (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces on delete cascade,
  assessment_id   uuid not null references public.assessments on delete cascade,
  framework       text not null check (framework in (
                    'tnfd','csrd','internal')),
  section_key     text not null,
  content_md      text not null default '',
  source_snapshot jsonb not null default '{}',
  status          text not null default 'draft' check (status in (
                    'draft','review','approved','published')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_disc_workspace  on public.disclosures (workspace_id);
create index idx_disc_assessment on public.disclosures (assessment_id);
create index idx_disc_framework  on public.disclosures (framework);

select public.apply_updated_at_trigger('disclosures');
