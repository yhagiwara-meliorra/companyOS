-- Fix column name bug in run_spatial_screening()
-- sites table uses "latitude"/"longitude", not "lat"/"lng"
-- This caused the point-based screening branch to silently fail.

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
      when s.latitude is not null and s.longitude is not null
        and (so.normalized_payload->>'lat') is not null
        and (so.normalized_payload->>'lng') is not null
        and ST_DWithin(
              ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography,
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
      when s.latitude is not null and s.longitude is not null
        and (so.normalized_payload->>'lat') is not null
        then ST_Distance(
               ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography,
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
      (s.latitude is not null and s.longitude is not null
       and (so.normalized_payload->>'lat') is not null
       and (so.normalized_payload->>'lng') is not null
       and ST_DWithin(
             ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography,
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
