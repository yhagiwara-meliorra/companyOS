-- ============================================================
-- Migration 005: External data sources / ingestion
--   data_sources, source_versions, ingestion_runs,
--   source_observations, spatial_intersections
-- ============================================================

-- ── data_sources ─────────────────────────────────────────────
create table public.data_sources (
  id          uuid primary key default gen_random_uuid(),
  source_key  text unique not null,
  source_name text not null,
  category    text not null check (category in (
                'protected_area','kba','water','forest',
                'land_cover','species','climate','custom')),
  license_type text,
  access_mode text not null default 'manual' check (access_mode in (
                'manual','api','file','customer_provided')),
  vendor_name text,
  config      jsonb not null default '{}',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_ds_category on public.data_sources (category);
create index idx_ds_active   on public.data_sources (is_active) where is_active = true;

select public.apply_updated_at_trigger('data_sources');

-- ── source_versions ──────────────────────────────────────────
create table public.source_versions (
  id             uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references public.data_sources on delete cascade,
  version_label  text not null,
  released_at    timestamptz,
  loaded_at      timestamptz not null default now(),
  checksum       text,
  metadata       jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

create index idx_sv_source on public.source_versions (data_source_id);

-- ── ingestion_runs ───────────────────────────────────────────
create table public.ingestion_runs (
  id                uuid primary key default gen_random_uuid(),
  data_source_id    uuid not null references public.data_sources on delete cascade,
  source_version_id uuid references public.source_versions,
  status            text not null default 'queued' check (status in (
                      'queued','running','succeeded','failed','partial')),
  started_at        timestamptz,
  completed_at      timestamptz,
  stats             jsonb not null default '{}',
  error_message     text,
  created_at        timestamptz not null default now()
);

create index idx_ir_source on public.ingestion_runs (data_source_id);
create index idx_ir_status on public.ingestion_runs (status);

-- ── source_observations ──────────────────────────────────────
-- Canonical external-source payloads are kept separate from business tables.
create table public.source_observations (
  id                uuid primary key default gen_random_uuid(),
  source_version_id uuid not null references public.source_versions on delete cascade,
  external_id       text,
  entity_type       text not null check (entity_type in (
                      'site','organization','region','species',
                      'protected_area','layer_cell')),
  raw_payload       jsonb not null,
  normalized_payload jsonb not null,
  observed_at       timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index idx_so_version     on public.source_observations (source_version_id);
create index idx_so_entity_type on public.source_observations (entity_type);
create index idx_so_external_id on public.source_observations (external_id)
  where external_id is not null;

-- ── spatial_intersections ────────────────────────────────────
-- Results of spatial joins between sites and external data layers.
-- Raw results are version-tracked; never overwritten.
create table public.spatial_intersections (
  id                  uuid primary key default gen_random_uuid(),
  workspace_site_id   uuid not null references public.workspace_sites on delete cascade,
  data_source_id      uuid not null references public.data_sources on delete cascade,
  source_version_id   uuid not null references public.source_versions on delete cascade,
  intersection_type   text not null check (intersection_type in (
                        'contains','within','intersects','nearby','same_region')),
  distance_m          numeric,
  area_overlap_m2     numeric,
  severity_hint       numeric(5,2),
  raw_result          jsonb not null default '{}',
  created_at          timestamptz not null default now()
);

create index idx_si_ws_site on public.spatial_intersections (workspace_site_id);
create index idx_si_source  on public.spatial_intersections (data_source_id);
create index idx_si_version on public.spatial_intersections (source_version_id);
