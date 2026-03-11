-- ============================================================
-- Migration: Ingestion framework helpers
--   1. Seed sample data_sources (protected areas, KBA, deforestation)
--   2. RPC: enqueue ingestion job via pgmq
--   3. RPC: perform spatial screening (PostGIS join) for a given
--      ingestion run's observations against workspace sites
-- ============================================================

-- ── 1. Seed sample data sources ──────────────────────────────
insert into public.data_sources (source_key, source_name, category, license_type, access_mode, config)
values
  ('wdpa_sample',
   'WDPA Protected Areas (sample)',
   'protected_area',
   'CC-BY-4.0',
   'file',
   '{"format": "geojson", "description": "Sample protected area polygons for testing"}'::jsonb),

  ('kba_sample',
   'Key Biodiversity Areas (sample)',
   'kba',
   'CC-BY-4.0',
   'file',
   '{"format": "geojson", "description": "Sample KBA polygons for testing"}'::jsonb),

  ('deforestation_sample',
   'Global Forest Watch Alerts (sample)',
   'forest',
   'CC-BY-4.0',
   'file',
   '{"format": "csv", "description": "Sample deforestation alert points for testing"}'::jsonb)
on conflict (source_key) do nothing;

-- ── 2. RPC: enqueue an ingestion job ─────────────────────────
-- Callable from the app (service_role) to start an ingestion run.
-- Creates the ingestion_run record and pushes a message to pgmq.
create or replace function public.enqueue_ingestion(
  p_data_source_id uuid,
  p_workspace_id   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
begin
  -- Create ingestion run
  insert into public.ingestion_runs (data_source_id, status)
  values (p_data_source_id, 'queued')
  returning id into v_run_id;

  -- Enqueue to pgmq
  perform pgmq.send(
    'ingestion_jobs',
    jsonb_build_object(
      'run_id',         v_run_id,
      'data_source_id', p_data_source_id,
      'workspace_id',   p_workspace_id
    )
  );

  return v_run_id;
end;
$$;

-- ── 3. RPC: spatial screening ────────────────────────────────
-- After observations are loaded, this function joins them against
-- workspace sites using PostGIS and writes spatial_intersections.
--
-- For point observations: checks distance to each site's point.
-- For polygon observations (GeoJSON in raw_payload.geometry):
--   uses ST_Intersects / ST_Distance on the geometry.
--
-- p_source_version_id: the version whose observations to screen
-- p_workspace_id: restrict to sites in this workspace
-- p_buffer_m: radius in meters for "nearby" intersections (default 50 km)
create or replace function public.run_spatial_screening(
  p_source_version_id uuid,
  p_workspace_id      uuid,
  p_buffer_m          numeric default 50000
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  -- Insert intersections for observations that have geometry
  insert into public.spatial_intersections (
    workspace_site_id,
    data_source_id,
    source_version_id,
    intersection_type,
    distance_m,
    raw_result
  )
  select
    ws.id                      as workspace_site_id,
    sv.data_source_id          as data_source_id,
    so.source_version_id       as source_version_id,
    case
      when s.geom is not null
        and so.raw_payload->'geometry' is not null
        and ST_Intersects(
              s.geom,
              ST_SetSRID(ST_GeomFromGeoJSON(so.raw_payload->>'geometry'), 4326)::geography::geometry
            )
        then 'intersects'
      when s.geom is not null
        and so.raw_payload->'geometry' is not null
        and ST_DWithin(
              s.geom::geography,
              ST_SetSRID(ST_GeomFromGeoJSON(so.raw_payload->>'geometry'), 4326)::geography,
              p_buffer_m
            )
        then 'nearby'
      -- Point-based observations (lat/lng in normalized_payload)
      when s.lat is not null and s.lng is not null
        and (so.normalized_payload->>'lat') is not null
        and (so.normalized_payload->>'lng') is not null
        and ST_DWithin(
              ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326)::geography,
              ST_SetSRID(
                ST_MakePoint(
                  (so.normalized_payload->>'lng')::numeric,
                  (so.normalized_payload->>'lat')::numeric
                ), 4326)::geography,
              p_buffer_m
            )
        then 'nearby'
      else null
    end                        as intersection_type,
    case
      when s.geom is not null
        and so.raw_payload->'geometry' is not null
        then ST_Distance(
               s.geom::geography,
               ST_SetSRID(ST_GeomFromGeoJSON(so.raw_payload->>'geometry'), 4326)::geography
             )
      when s.lat is not null and s.lng is not null
        and (so.normalized_payload->>'lat') is not null
        then ST_Distance(
               ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326)::geography,
               ST_SetSRID(
                 ST_MakePoint(
                   (so.normalized_payload->>'lng')::numeric,
                   (so.normalized_payload->>'lat')::numeric
                 ), 4326)::geography
             )
      else null
    end                        as distance_m,
    jsonb_build_object(
      'observation_id', so.id,
      'external_id',    so.external_id,
      'entity_type',    so.entity_type,
      'observation',    so.normalized_payload
    )                          as raw_result
  from public.source_observations so
  join public.source_versions sv on sv.id = so.source_version_id
  cross join public.workspace_sites ws
  join public.sites s on s.id = ws.site_id
  where so.source_version_id = p_source_version_id
    and ws.workspace_id = p_workspace_id
    -- Filter: only keep rows where intersection was detected
    and (
      -- Geometry-based intersection or nearby
      (s.geom is not null
       and so.raw_payload->'geometry' is not null
       and ST_DWithin(
             s.geom::geography,
             ST_SetSRID(ST_GeomFromGeoJSON(so.raw_payload->>'geometry'), 4326)::geography,
             p_buffer_m
           ))
      or
      -- Point-based nearby
      (s.lat is not null and s.lng is not null
       and (so.normalized_payload->>'lat') is not null
       and (so.normalized_payload->>'lng') is not null
       and ST_DWithin(
             ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326)::geography,
             ST_SetSRID(
               ST_MakePoint(
                 (so.normalized_payload->>'lng')::numeric,
                 (so.normalized_payload->>'lat')::numeric
               ), 4326)::geography,
             p_buffer_m
           ))
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.enqueue_ingestion is
  'Create an ingestion_run and push it to the pgmq ingestion_jobs queue.';

comment on function public.run_spatial_screening is
  'Spatial-join source_observations against workspace_sites (PostGIS). Returns number of intersections found.';
