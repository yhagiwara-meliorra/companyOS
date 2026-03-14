-- ============================================================
-- Migration: EUDR DDS Core Tables
--   eudr_dds_statements, eudr_dds_product_lines,
--   eudr_dds_plots, eudr_dds_upstream_refs
-- ============================================================

-- ── eudr_dds_statements ─────────────────────────────────────
-- Due Diligence Statement — one DDS per market placing / export
create table public.eudr_dds_statements (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references public.workspaces on delete cascade,
  assessment_id           uuid references public.assessments on delete set null,
  operator_org_id         uuid not null references public.organizations on delete restrict,
  internal_reference      text not null,
  operator_type           text not null check (operator_type in (
                            'operator','non_sme_trader','sme_trader')),
  status                  text not null default 'draft' check (status in (
                            'draft','ready','submitted','validated','rejected','withdrawn')),
  eu_reference_number     text,
  eu_verification_number  text,
  submission_date         date,
  valid_from              date,
  valid_to                date,
  country_of_activity     text,
  description             text,
  notes                   text,
  created_by              uuid references auth.users,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz
);

create index idx_edds_workspace on public.eudr_dds_statements (workspace_id) where deleted_at is null;
create index idx_edds_status    on public.eudr_dds_statements (status) where deleted_at is null;
create index idx_edds_operator  on public.eudr_dds_statements (operator_org_id);
create index idx_edds_ref       on public.eudr_dds_statements (eu_reference_number) where eu_reference_number is not null;

select public.apply_updated_at_trigger('eudr_dds_statements');

-- ── eudr_dds_product_lines ──────────────────────────────────
-- Product/commodity line items within a DDS
-- Each row = one CN code + commodity combination
create table public.eudr_dds_product_lines (
  id                      uuid primary key default gen_random_uuid(),
  dds_id                  uuid not null references public.eudr_dds_statements on delete cascade,
  commodity_code_id       uuid references public.eudr_commodity_codes,
  commodity_type          text not null check (commodity_type in (
                            'cattle','cocoa','coffee','oil_palm','rubber','soya','wood')),
  cn_code                 text not null,
  product_description     text not null,
  quantity_kg             numeric,
  quantity_unit           text default 'kg',
  country_of_production   text not null,
  hs_code                 text,
  trade_name              text,
  scientific_name         text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_edpl_dds       on public.eudr_dds_product_lines (dds_id);
create index idx_edpl_commodity on public.eudr_dds_product_lines (commodity_type);
create index idx_edpl_country   on public.eudr_dds_product_lines (country_of_production);

select public.apply_updated_at_trigger('eudr_dds_product_lines');

-- ── eudr_dds_plots ──────────────────────────────────────────
-- Production plots / parcels with geolocation
-- < 4 ha = point geolocation
-- >= 4 ha = polygon geolocation
create table public.eudr_dds_plots (
  id                      uuid primary key default gen_random_uuid(),
  product_line_id         uuid not null references public.eudr_dds_product_lines on delete cascade,
  site_id                 uuid references public.sites,
  plot_reference          text,
  geolocation_type        text not null check (geolocation_type in ('point','polygon')),
  latitude                double precision,
  longitude               double precision,
  geom_point              extensions.geography(point, 4326),
  geom_polygon            extensions.geography(multipolygon, 4326),
  geojson                 jsonb,
  area_ha                 numeric,
  country_of_production   text not null,
  region                  text,
  production_start_date   date,
  production_end_date     date,
  deforestation_free      boolean,
  deforestation_cutoff    date default '2020-12-31',
  verification_status     text not null default 'declared' check (verification_status in (
                            'inferred','declared','verified')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_edp_product_line on public.eudr_dds_plots (product_line_id);
create index idx_edp_site         on public.eudr_dds_plots (site_id) where site_id is not null;
create index idx_edp_geom_pt      on public.eudr_dds_plots using gist (geom_point);
create index idx_edp_geom_poly    on public.eudr_dds_plots using gist (geom_polygon);
create index idx_edp_country      on public.eudr_dds_plots (country_of_production);

select public.apply_updated_at_trigger('eudr_dds_plots');

-- Auto-sync lat/lng → PostGIS point on insert/update
create or replace function public.eudr_plots_sync_geom()
returns trigger as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.geom_point = st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::extensions.geography;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger eudr_plots_sync_geom_trigger
  before insert or update of latitude, longitude on public.eudr_dds_plots
  for each row execute function public.eudr_plots_sync_geom();

-- ── eudr_dds_upstream_refs ──────────────────────────────────
-- References to upstream DDS statements (for DAG traceability)
create table public.eudr_dds_upstream_refs (
  id                      uuid primary key default gen_random_uuid(),
  dds_id                  uuid not null references public.eudr_dds_statements on delete cascade,
  reference_number        text not null,
  verification_number     text,
  upstream_operator_name  text,
  upstream_eori           text,
  upstream_country        text,
  commodity_type          text,
  verified_in_traces      boolean not null default false,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_edur_dds on public.eudr_dds_upstream_refs (dds_id);
create index idx_edur_ref on public.eudr_dds_upstream_refs (reference_number);

select public.apply_updated_at_trigger('eudr_dds_upstream_refs');
