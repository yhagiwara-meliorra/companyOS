-- ============================================================
-- Migration 004: Supply graph tables
--   sites, organization_sites, workspace_sites,
--   materials, processes,
--   supply_relationships, supply_edges, supply_edge_materials
-- ============================================================

-- ── sites ────────────────────────────────────────────────────
create table public.sites (
  id                  uuid primary key default gen_random_uuid(),
  site_name           text not null,
  site_type           text not null default 'unknown' check (site_type in (
                        'office','factory','warehouse','farm','mine',
                        'port','project_site','store','unknown')),
  country_code        text,
  region              text,
  locality            text,
  address_text        text,
  latitude            double precision,
  longitude           double precision,
  geom                extensions.geography(point, 4326),
  geocode_precision   text check (geocode_precision in (
                        'country','region','city','address','parcel','manual')),
  verification_status text not null default 'inferred' check (verification_status in (
                        'inferred','declared','verified')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

-- Spatial index on the geography column
create index idx_sites_geom on public.sites using gist (geom);
create index idx_sites_country on public.sites (country_code) where deleted_at is null;
create index idx_sites_type on public.sites (site_type) where deleted_at is null;

-- Auto-sync lat/lng → PostGIS geom on insert/update
create or replace function public.sites_sync_geom()
returns trigger as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.geom = st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::extensions.geography;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger sites_sync_geom_trigger
  before insert or update of latitude, longitude on public.sites
  for each row execute function public.sites_sync_geom();

select public.apply_updated_at_trigger('sites');

-- ── organization_sites ───────────────────────────────────────
create table public.organization_sites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  site_id         uuid not null references public.sites on delete cascade,
  ownership_role  text not null check (ownership_role in (
                    'owner','operator','tenant','supplier_site','customer_site')),
  is_primary      boolean not null default false,
  valid_from      date,
  valid_to        date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, site_id, ownership_role)
);

create index idx_os_org  on public.organization_sites (organization_id);
create index idx_os_site on public.organization_sites (site_id);

select public.apply_updated_at_trigger('organization_sites');

-- ── workspace_sites ──────────────────────────────────────────
create table public.workspace_sites (
  id                        uuid primary key default gen_random_uuid(),
  workspace_id              uuid not null references public.workspaces on delete cascade,
  site_id                   uuid not null references public.sites on delete cascade,
  workspace_organization_id uuid references public.workspace_organizations on delete set null,
  scope_role                text not null check (scope_role in (
                              'own_operation','upstream','downstream',
                              'logistics','portfolio_asset')),
  tier                      integer,
  criticality               numeric(5,2) not null default 0,
  verification_status       text not null default 'inferred' check (verification_status in (
                              'inferred','declared','verified')),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  -- unique constraint uses coalesce to handle nullable tier
  unique (workspace_id, site_id, scope_role, tier)
);

create index idx_ws_workspace on public.workspace_sites (workspace_id);
create index idx_ws_site      on public.workspace_sites (site_id);
create index idx_ws_wo        on public.workspace_sites (workspace_organization_id);

select public.apply_updated_at_trigger('workspace_sites');

-- ── materials ────────────────────────────────────────────────
create table public.materials (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text,
  hs_code     text,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (name, hs_code)
);

select public.apply_updated_at_trigger('materials');

-- ── processes ────────────────────────────────────────────────
create table public.processes (
  id            uuid primary key default gen_random_uuid(),
  process_code  text unique not null,
  name          text not null,
  process_group text not null,
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

select public.apply_updated_at_trigger('processes');

-- ── supply_relationships ─────────────────────────────────────
create table public.supply_relationships (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces on delete cascade,
  from_workspace_org_id uuid not null references public.workspace_organizations on delete cascade,
  to_workspace_org_id   uuid not null references public.workspace_organizations on delete cascade,
  relationship_type     text not null check (relationship_type in (
                          'supplies','manufactures_for','ships_for','sells_to','owns')),
  tier                  integer,
  verification_status   text not null default 'inferred' check (verification_status in (
                          'inferred','declared','verified')),
  confidence_score      numeric(5,2) not null default 0,
  source_type           text not null default 'manual' check (source_type in (
                          'manual','csv','api','survey','inference')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

create index idx_sr_workspace on public.supply_relationships (workspace_id) where deleted_at is null;
create index idx_sr_from      on public.supply_relationships (from_workspace_org_id);
create index idx_sr_to        on public.supply_relationships (to_workspace_org_id);

select public.apply_updated_at_trigger('supply_relationships');

-- ── supply_edges ─────────────────────────────────────────────
create table public.supply_edges (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces on delete cascade,
  relationship_id     uuid not null references public.supply_relationships on delete cascade,
  from_site_id        uuid references public.sites,
  to_site_id          uuid references public.sites,
  process_id          uuid references public.processes,
  flow_direction      text not null check (flow_direction in ('upstream','downstream')),
  annual_volume       numeric,
  annual_spend        numeric,
  currency_code       text,
  verification_status text not null default 'inferred' check (verification_status in (
                        'inferred','declared','verified')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index idx_se_workspace    on public.supply_edges (workspace_id) where deleted_at is null;
create index idx_se_relationship on public.supply_edges (relationship_id);
create index idx_se_from_site    on public.supply_edges (from_site_id);
create index idx_se_to_site      on public.supply_edges (to_site_id);

select public.apply_updated_at_trigger('supply_edges');

-- ── supply_edge_materials ────────────────────────────────────
create table public.supply_edge_materials (
  id             uuid primary key default gen_random_uuid(),
  supply_edge_id uuid not null references public.supply_edges on delete cascade,
  material_id    uuid not null references public.materials on delete cascade,
  share_ratio    numeric(5,4),
  is_critical    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_sem_edge     on public.supply_edge_materials (supply_edge_id);
create index idx_sem_material on public.supply_edge_materials (material_id);

select public.apply_updated_at_trigger('supply_edge_materials');
