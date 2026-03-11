// Supabase Edge Function: ingest-source
// Processes ingestion jobs from the pgmq `ingestion_jobs` queue.
//
// Invocation:
//   POST /functions/v1/ingest-source
//   Body (optional): { "data_source_id": "...", "workspace_id": "...", "run_id": "..." }
//   - With body: direct invocation (skips pgmq)
//   - Without body: reads from pgmq queue
//
// Flow:
//   1. Read a message from pgmq `ingestion_jobs` (or body payload)
//   2. Update ingestion_run status → running
//   3. Based on data_source config, load observations
//   4. Insert into source_observations
//   5. Call run_spatial_screening() RPC
//   6. Mark ingestion_run as succeeded/failed

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Types ────────────────────────────────────────────────

interface IngestionPayload {
  run_id: string;
  data_source_id: string;
  workspace_id: string;
}

interface Observation {
  external_id: string;
  entity_type: string;
  raw_payload: Record<string, unknown>;
  normalized_payload: Record<string, unknown>;
}

// ── Main handler ─────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ── Resolve ingestion payload ──────────────────────
    let payload: IngestionPayload | null = null;
    let msgId: number | null = null;

    // Try body payload first (direct invocation)
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.data_source_id && body.workspace_id) {
          // Direct invocation — create an ingestion_run if not provided
          if (body.run_id) {
            payload = body as IngestionPayload;
          } else {
            const { data: run, error: runErr } = await admin
              .from("ingestion_runs")
              .insert({
                data_source_id: body.data_source_id,
                status: "queued",
              })
              .select("id")
              .single();
            if (runErr || !run) {
              return jsonResponse({
                status: "failed",
                error: runErr?.message ?? "Failed to create run",
              });
            }
            payload = {
              run_id: run.id,
              data_source_id: body.data_source_id,
              workspace_id: body.workspace_id,
            };
          }
        }
      } catch {
        // Body parse failed — fall through to pgmq
      }
    }

    // If no direct payload, try pgmq queue
    if (!payload) {
      const queueResult = await readFromQueue(admin);
      if (!queueResult) {
        return jsonResponse({ status: "no_jobs" });
      }
      payload = queueResult.payload;
      msgId = queueResult.msgId;
    }

    const { run_id: runId, data_source_id: dataSourceId, workspace_id: workspaceId } =
      payload;

    console.log(`[ingest] Processing run=${runId} source=${dataSourceId}`);

    // ── 1. Update run → running ──────────────────────
    await admin
      .from("ingestion_runs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", runId);

    // ── 2. Get data source config ────────────────────
    const { data: ds } = await admin
      .from("data_sources")
      .select("*")
      .eq("id", dataSourceId)
      .single();

    if (!ds) {
      await failRun(admin, runId, "Data source not found");
      if (msgId) await archiveMessage(admin, msgId);
      return jsonResponse({ status: "failed", error: "Data source not found" });
    }

    // ── 3. Create source version ─────────────────────
    const { data: sv, error: svErr } = await admin
      .from("source_versions")
      .insert({
        data_source_id: dataSourceId,
        version_label: `auto-${new Date().toISOString().slice(0, 19)}`,
        released_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (svErr || !sv) {
      await failRun(admin, runId, svErr?.message ?? "Failed to create version");
      if (msgId) await archiveMessage(admin, msgId);
      return jsonResponse({
        status: "failed",
        error: svErr?.message ?? "Failed to create version",
      });
    }

    // ── 4. Load observations based on access_mode ────
    let observations: Observation[] = [];

    switch (ds.access_mode) {
      case "api":
        observations = await loadFromApi(ds);
        break;
      case "file":
        observations = await loadFromStorage(admin, ds);
        break;
      case "customer_provided":
        observations = await loadFromStorage(admin, ds);
        break;
      case "manual":
      default:
        // Load built-in sample data for demo/development
        observations = getSampleObservations(ds.category, ds.source_key);
        break;
    }

    console.log(
      `[ingest] Loaded ${observations.length} observations for category=${ds.category}`
    );

    // ── 5. Insert observations in batches ────────────
    const BATCH_SIZE = 200;
    let insertedCount = 0;

    for (let i = 0; i < observations.length; i += BATCH_SIZE) {
      const batch = observations.slice(i, i + BATCH_SIZE).map((obs) => ({
        source_version_id: sv.id,
        external_id: obs.external_id,
        entity_type: obs.entity_type,
        raw_payload: obs.raw_payload,
        normalized_payload: obs.normalized_payload,
      }));

      const { error: obsErr } = await admin
        .from("source_observations")
        .insert(batch);

      if (obsErr) {
        console.error(`[ingest] Batch insert error at offset ${i}:`, obsErr.message);
        // Continue with next batch instead of failing completely
      } else {
        insertedCount += batch.length;
      }
    }

    // ── 6. Run spatial screening ─────────────────────
    let intersectionsFound = 0;

    if (workspaceId && insertedCount > 0) {
      const { data: count, error: screenErr } = await admin.rpc(
        "run_spatial_screening",
        {
          p_source_version_id: sv.id,
          p_workspace_id: workspaceId,
          p_buffer_m: 50000, // 50 km buffer
        }
      );

      if (screenErr) {
        console.error("[ingest] Spatial screening error:", screenErr.message);
      } else {
        intersectionsFound = count ?? 0;
      }
    }

    // ── 7. Mark run as succeeded ─────────────────────
    const finalStatus = insertedCount > 0 ? "succeeded" : "partial";
    await admin
      .from("ingestion_runs")
      .update({
        source_version_id: sv.id,
        status: finalStatus,
        completed_at: new Date().toISOString(),
        stats: {
          observations_loaded: insertedCount,
          observations_total: observations.length,
          intersections_found: intersectionsFound,
        },
      })
      .eq("id", runId);

    // Archive the pgmq message
    if (msgId) await archiveMessage(admin, msgId);

    console.log(
      `[ingest] Completed run=${runId}: ${insertedCount} obs, ${intersectionsFound} intersections`
    );

    return jsonResponse({
      status: finalStatus,
      run_id: runId,
      observations_loaded: insertedCount,
      intersections_found: intersectionsFound,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[ingest] Fatal error:", message);
    return jsonResponse({ status: "error", error: message }, 500);
  }
});

// ── Helper: JSON response ────────────────────────────────

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Helper: Read from pgmq ──────────────────────────────

async function readFromQueue(
  admin: ReturnType<typeof createClient>
): Promise<{ payload: IngestionPayload; msgId: number } | null> {
  // Try standard pgmq_read first
  const { data: messages, error: mqErr } = await admin.rpc("pgmq_read", {
    queue_name: "ingestion_jobs",
    vt: 120,
    qty: 1,
  });

  if (!mqErr && messages && messages.length > 0) {
    const msg = messages[0];
    return {
      payload: (msg.message ?? msg.msg) as IngestionPayload,
      msgId: msg.msg_id,
    };
  }

  // Fallback: try read (some pgmq versions expose it differently)
  if (mqErr) {
    const { data: raw, error: rawErr } = await admin.rpc("read", {
      queue_name: "ingestion_jobs",
      vt: 120,
      qty: 1,
    });

    if (!rawErr && raw && raw.length > 0) {
      const msg = raw[0];
      return {
        payload: (msg.message ?? msg.msg) as IngestionPayload,
        msgId: msg.msg_id,
      };
    }
  }

  return null;
}

// ── Helper: Fail a run ───────────────────────────────────

async function failRun(
  admin: ReturnType<typeof createClient>,
  runId: string,
  errorMessage: string
) {
  await admin
    .from("ingestion_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq("id", runId);
}

// ── Helper: Archive pgmq message ─────────────────────────

async function archiveMessage(
  admin: ReturnType<typeof createClient>,
  msgId: number
) {
  await admin
    .rpc("pgmq_archive", {
      queue_name: "ingestion_jobs",
      msg_id: msgId,
    })
    .catch((err: Error) => {
      console.warn("[ingest] Archive failed:", err.message);
    });
}

// ── Data Loading: API sources ────────────────────────────
// Fetches data from an external API endpoint defined in ds.config.url

async function loadFromApi(
  ds: Record<string, unknown>
): Promise<Observation[]> {
  const config = (ds.config ?? {}) as Record<string, unknown>;
  const url = config.url as string | undefined;
  if (!url) {
    console.warn(`[ingest] No API URL configured for source ${ds.source_key}`);
    return getSampleObservations(
      ds.category as string,
      ds.source_key as string
    );
  }

  try {
    const resp = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(config.api_key
          ? { Authorization: `Bearer ${config.api_key}` }
          : {}),
      },
    });

    if (!resp.ok) {
      console.error(`[ingest] API fetch failed: ${resp.status} ${resp.statusText}`);
      return [];
    }

    const data = await resp.json();
    const features = data.features ?? data.results ?? data.data ?? [];

    if (!Array.isArray(features)) {
      console.warn("[ingest] API response is not an array, wrapping single item");
      return [normalizeFeature(features, ds.category as string)];
    }

    return features.map((f: Record<string, unknown>) =>
      normalizeFeature(f, ds.category as string)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown fetch error";
    console.error(`[ingest] API fetch error: ${msg}`);
    return [];
  }
}

// ── Data Loading: Storage/file sources ───────────────────
// Reads GeoJSON files from Supabase Storage bucket `ingestion-data`

async function loadFromStorage(
  admin: ReturnType<typeof createClient>,
  ds: Record<string, unknown>
): Promise<Observation[]> {
  const config = (ds.config ?? {}) as Record<string, unknown>;
  const storagePath = config.storage_path as string | undefined;

  if (!storagePath) {
    console.warn(
      `[ingest] No storage_path configured for source ${ds.source_key}`
    );
    return getSampleObservations(
      ds.category as string,
      ds.source_key as string
    );
  }

  try {
    const { data: fileData, error: dlErr } = await admin.storage
      .from("ingestion-data")
      .download(storagePath);

    if (dlErr || !fileData) {
      console.error(`[ingest] Storage download failed: ${dlErr?.message}`);
      return [];
    }

    const text = await fileData.text();
    const geojson = JSON.parse(text);
    const features = geojson.features ?? [geojson];

    return features.map((f: Record<string, unknown>) =>
      normalizeFeature(f, ds.category as string)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown storage error";
    console.error(`[ingest] Storage load error: ${msg}`);
    return [];
  }
}

// ── Feature normalizer ───────────────────────────────────
// Converts a GeoJSON-like feature into a source_observation

function normalizeFeature(
  feature: Record<string, unknown>,
  category: string
): Observation {
  const props = (feature.properties ?? feature) as Record<string, unknown>;
  const geometry = feature.geometry as Record<string, unknown> | undefined;
  const externalId =
    (props.id ?? props.external_id ?? props.wdpa_pid ?? props.site_id ?? crypto.randomUUID()) as string;

  // Extract centroid if geometry is available
  let lat: number | null = null;
  let lng: number | null = null;

  if (geometry?.type === "Point" && Array.isArray(geometry.coordinates)) {
    lng = geometry.coordinates[0] as number;
    lat = geometry.coordinates[1] as number;
  } else if (
    geometry?.type === "Polygon" &&
    Array.isArray(geometry.coordinates)
  ) {
    // Simple centroid of first ring
    const ring = geometry.coordinates[0] as number[][];
    if (ring && ring.length > 0) {
      const sumLng = ring.reduce((s, c) => s + c[0], 0);
      const sumLat = ring.reduce((s, c) => s + c[1], 0);
      lng = sumLng / ring.length;
      lat = sumLat / ring.length;
    }
  }

  // Map entity_type from category
  const entityTypeMap: Record<string, string> = {
    protected_area: "protected_area",
    kba: "protected_area",
    species: "species",
    forest: "layer_cell",
    water: "layer_cell",
    land_cover: "layer_cell",
    climate: "layer_cell",
    custom: "region",
  };

  return {
    external_id: String(externalId),
    entity_type: entityTypeMap[category] ?? "region",
    raw_payload: feature,
    normalized_payload: {
      ...props,
      category,
      ...(lat != null ? { lat } : {}),
      ...(lng != null ? { lng } : {}),
    },
  };
}

// ── Sample data generator ────────────────────────────────
// Built-in sample observations for development/demo.
// Mirrors the data in lib/domain/ingestion-actions.ts.

function getSampleObservations(
  category: string,
  _sourceKey: string
): Observation[] {
  switch (category) {
    case "protected_area":
      return [
        {
          external_id: "PA-001",
          entity_type: "protected_area",
          raw_payload: {
            name: "Amazonia National Park",
            iucn_cat: "II",
            geometry: {
              type: "Polygon",
              coordinates: [[[-56, -4], [-55, -4], [-55, -3], [-56, -3], [-56, -4]]],
            },
          },
          normalized_payload: {
            name: "Amazonia National Park",
            category: "National Park",
            iucn_category: "II",
            country: "BRA",
            lat: -3.5,
            lng: -55.5,
          },
        },
        {
          external_id: "PA-002",
          entity_type: "protected_area",
          raw_payload: {
            name: "Cerrado Reserve",
            iucn_cat: "IV",
            geometry: {
              type: "Polygon",
              coordinates: [[[-48, -15], [-47, -15], [-47, -14], [-48, -14], [-48, -15]]],
            },
          },
          normalized_payload: {
            name: "Cerrado Reserve",
            category: "Habitat Management Area",
            iucn_category: "IV",
            country: "BRA",
            lat: -14.5,
            lng: -47.5,
          },
        },
        {
          external_id: "PA-003",
          entity_type: "protected_area",
          raw_payload: {
            name: "Borneo Rainforest Reserve",
            iucn_cat: "II",
            geometry: {
              type: "Polygon",
              coordinates: [[[116, 4], [117, 4], [117, 5], [116, 5], [116, 4]]],
            },
          },
          normalized_payload: {
            name: "Borneo Rainforest Reserve",
            category: "National Park",
            iucn_category: "II",
            country: "MYS",
            lat: 4.5,
            lng: 116.5,
          },
        },
      ];

    case "kba":
      return [
        {
          external_id: "KBA-001",
          entity_type: "protected_area",
          raw_payload: {
            name: "Upper Amazon KBA",
            criteria: "A1a",
            geometry: {
              type: "Polygon",
              coordinates: [[[-70, -5], [-69, -5], [-69, -4], [-70, -4], [-70, -5]]],
            },
          },
          normalized_payload: {
            name: "Upper Amazon KBA",
            category: "Key Biodiversity Area",
            kba_criteria: "A1a",
            country: "PER",
            lat: -4.5,
            lng: -69.5,
          },
        },
        {
          external_id: "KBA-002",
          entity_type: "protected_area",
          raw_payload: {
            name: "Sumatra Lowland KBA",
            criteria: "B1",
            geometry: {
              type: "Polygon",
              coordinates: [[[103, -1], [104, -1], [104, 0], [103, 0], [103, -1]]],
            },
          },
          normalized_payload: {
            name: "Sumatra Lowland KBA",
            category: "Key Biodiversity Area",
            kba_criteria: "B1",
            country: "IDN",
            lat: -0.5,
            lng: 103.5,
          },
        },
      ];

    case "forest":
      return [
        {
          external_id: "DEF-001",
          entity_type: "layer_cell",
          raw_payload: {
            alert_date: "2026-01-15",
            confidence: "high",
            area_ha: 25.3,
          },
          normalized_payload: {
            alert_date: "2026-01-15",
            confidence: "high",
            area_ha: 25.3,
            lat: -3.8,
            lng: -55.2,
          },
        },
        {
          external_id: "DEF-002",
          entity_type: "layer_cell",
          raw_payload: {
            alert_date: "2026-02-03",
            confidence: "nominal",
            area_ha: 12.1,
          },
          normalized_payload: {
            alert_date: "2026-02-03",
            confidence: "nominal",
            area_ha: 12.1,
            lat: -14.3,
            lng: -47.8,
          },
        },
        {
          external_id: "DEF-003",
          entity_type: "layer_cell",
          raw_payload: {
            alert_date: "2026-02-28",
            confidence: "high",
            area_ha: 45.0,
          },
          normalized_payload: {
            alert_date: "2026-02-28",
            confidence: "high",
            area_ha: 45.0,
            lat: 4.3,
            lng: 116.7,
          },
        },
      ];

    case "water":
      return [
        {
          external_id: "WS-001",
          entity_type: "layer_cell",
          raw_payload: {
            basin_name: "Amazon Basin",
            stress_level: "low",
            withdrawal_m3: 150000,
          },
          normalized_payload: {
            basin_name: "Amazon Basin",
            stress_level: "low",
            withdrawal_m3: 150000,
            lat: -3.2,
            lng: -60.0,
          },
        },
        {
          external_id: "WS-002",
          entity_type: "layer_cell",
          raw_payload: {
            basin_name: "Ganges Basin",
            stress_level: "extremely_high",
            withdrawal_m3: 980000,
          },
          normalized_payload: {
            basin_name: "Ganges Basin",
            stress_level: "extremely_high",
            withdrawal_m3: 980000,
            lat: 25.3,
            lng: 83.0,
          },
        },
      ];

    case "species":
      return [
        {
          external_id: "SP-001",
          entity_type: "species",
          raw_payload: {
            scientific_name: "Panthera tigris",
            common_name: "Tiger",
            iucn_status: "EN",
            population_trend: "decreasing",
          },
          normalized_payload: {
            scientific_name: "Panthera tigris",
            common_name: "Tiger",
            iucn_status: "EN",
            population_trend: "decreasing",
            lat: 4.5,
            lng: 103.5,
          },
        },
        {
          external_id: "SP-002",
          entity_type: "species",
          raw_payload: {
            scientific_name: "Pongo pygmaeus",
            common_name: "Bornean Orangutan",
            iucn_status: "CR",
            population_trend: "decreasing",
          },
          normalized_payload: {
            scientific_name: "Pongo pygmaeus",
            common_name: "Bornean Orangutan",
            iucn_status: "CR",
            population_trend: "decreasing",
            lat: 1.5,
            lng: 110.0,
          },
        },
      ];

    default:
      return [];
  }
}
