-- ============================================================
-- Migration: EUDR Cattle Tables
--   eudr_dds_cattle_animals, eudr_dds_cattle_establishments
-- ============================================================

-- ── eudr_dds_cattle_animals ─────────────────────────────────
-- Individual cattle records within a DDS product line
create table public.eudr_dds_cattle_animals (
  id                      uuid primary key default gen_random_uuid(),
  product_line_id         uuid not null references public.eudr_dds_product_lines on delete cascade,
  animal_identifier       text not null,
  ear_tag_number          text,
  date_of_birth           date,
  date_of_death           date,
  breed                   text,
  sex                     text check (sex in ('male','female','unknown')),
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_edca_product_line on public.eudr_dds_cattle_animals (product_line_id);
create index idx_edca_identifier   on public.eudr_dds_cattle_animals (animal_identifier);

select public.apply_updated_at_trigger('eudr_dds_cattle_animals');

-- ── eudr_dds_cattle_establishments ──────────────────────────
-- Establishment chain for a cattle animal (birthplace → rearing → slaughter)
create table public.eudr_dds_cattle_establishments (
  id                      uuid primary key default gen_random_uuid(),
  cattle_animal_id        uuid not null references public.eudr_dds_cattle_animals on delete cascade,
  site_id                 uuid references public.sites,
  establishment_type      text not null check (establishment_type in (
                            'birthplace','rearing_farm','feeding_facility',
                            'grazing_land','slaughterhouse')),
  establishment_name      text,
  latitude                double precision,
  longitude               double precision,
  geom                    extensions.geography(point, 4326),
  country_code            text not null,
  region                  text,
  date_entered            date,
  date_left               date,
  sequence_order          integer not null default 0,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_edce_animal    on public.eudr_dds_cattle_establishments (cattle_animal_id);
create index idx_edce_site      on public.eudr_dds_cattle_establishments (site_id) where site_id is not null;
create index idx_edce_geom      on public.eudr_dds_cattle_establishments using gist (geom);
create index idx_edce_type      on public.eudr_dds_cattle_establishments (establishment_type);
create index idx_edce_sequence  on public.eudr_dds_cattle_establishments (cattle_animal_id, sequence_order);

select public.apply_updated_at_trigger('eudr_dds_cattle_establishments');

-- Auto-sync lat/lng → PostGIS point on insert/update
create or replace function public.eudr_cattle_est_sync_geom()
returns trigger as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.geom = st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::extensions.geography;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger eudr_cattle_est_sync_geom_trigger
  before insert or update of latitude, longitude on public.eudr_dds_cattle_establishments
  for each row execute function public.eudr_cattle_est_sync_geom();
