"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/supabase-server";
import { createAdminClient } from "@/lib/db/admin";
import { appendChangeLog } from "@/lib/domain/change-log";
import { z } from "zod/v4";

export type ActionState = { error?: string; success?: boolean; runId?: string };

// ── Schemas ─────────────────────────────────────────────────
const DataSourceSchema = z.object({
  sourceKey: z
    .string()
    .min(1, "Source key is required")
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, underscores"),
  sourceName: z.string().min(1, "Source name is required"),
  category: z.enum([
    "protected_area",
    "kba",
    "water",
    "forest",
    "land_cover",
    "species",
    "climate",
    "custom",
  ]),
  licenseType: z.string().optional(),
  accessMode: z.enum(["manual", "api", "file", "customer_provided"]).default("manual"),
  vendorName: z.string().optional(),
});

// ── Create Data Source ───────────────────────────────────────
export async function createDataSource(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = DataSourceSchema.safeParse({
    sourceKey: formData.get("sourceKey"),
    sourceName: formData.get("sourceName"),
    category: formData.get("category"),
    licenseType: formData.get("licenseType") || undefined,
    accessMode: formData.get("accessMode") || "manual",
    vendorName: formData.get("vendorName") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { error } = await admin.from("data_sources").insert({
    source_key: parsed.data.sourceKey,
    source_name: parsed.data.sourceName,
    category: parsed.data.category,
    license_type: parsed.data.licenseType || null,
    access_mode: parsed.data.accessMode,
    vendor_name: parsed.data.vendorName || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/app");
  return { success: true };
}

// ── Trigger Ingestion ────────────────────────────────────────
// Creates an ingestion_run and enqueues to pgmq via the RPC function.
export async function triggerIngestion(
  workspaceSlug: string,
  dataSourceId: string
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  // Resolve workspace ID
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .is("deleted_at", null)
    .single();
  if (!ws) return { error: "Workspace not found" };

  // Call the enqueue RPC
  const { data: runId, error } = await admin.rpc("enqueue_ingestion", {
    p_data_source_id: dataSourceId,
    p_workspace_id: ws.id,
  });

  if (error) return { error: error.message };

  await appendChangeLog(ws.id, user.id, "ingestion_runs", runId as string, "trigger_ingestion", null, {
    data_source_id: dataSourceId,
  });

  revalidatePath(`/app/${workspaceSlug}/sources`);
  return { success: true, runId: runId as string };
}

// ── Manual Ingestion: process sample GeoJSON inline ──────────
// For MVP / local dev: directly processes sample data without
// the Edge Function, so the pipeline works even without
// `supabase functions serve`.
export async function runSampleIngestion(
  workspaceSlug: string,
  dataSourceId: string
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  // Resolve workspace
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .is("deleted_at", null)
    .single();
  if (!ws) return { error: "Workspace not found" };

  // Get data source
  const { data: ds } = await admin
    .from("data_sources")
    .select("*")
    .eq("id", dataSourceId)
    .single();
  if (!ds) return { error: "Data source not found" };

  // Create ingestion run
  const { data: run, error: runErr } = await admin
    .from("ingestion_runs")
    .insert({
      data_source_id: dataSourceId,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (runErr || !run) return { error: runErr?.message ?? "Failed to create run" };

  try {
    // Create source version
    const { data: sv, error: svErr } = await admin
      .from("source_versions")
      .insert({
        data_source_id: dataSourceId,
        version_label: `sample-${new Date().toISOString().slice(0, 10)}`,
        released_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (svErr || !sv) throw new Error(svErr?.message ?? "Failed to create version");

    // Load sample observations based on category
    const observations = getSampleObservations(ds.category, ds.source_key);

    if (observations.length > 0) {
      // Batch insert observations
      const obPayloads = observations.map((obs) => ({
        source_version_id: sv.id,
        external_id: obs.external_id,
        entity_type: obs.entity_type,
        raw_payload: obs.raw_payload,
        normalized_payload: obs.normalized_payload,
      }));

      const { error: obsErr } = await admin
        .from("source_observations")
        .insert(obPayloads);
      if (obsErr) throw new Error(`Observation insert: ${obsErr.message}`);
    }

    // Run spatial screening via RPC
    const { data: intersectionCount, error: screenErr } = await admin.rpc(
      "run_spatial_screening",
      {
        p_source_version_id: sv.id,
        p_workspace_id: ws.id,
        p_buffer_m: 50000, // 50 km
      }
    );
    if (screenErr) throw new Error(`Spatial screening: ${screenErr.message}`);

    // Mark run as succeeded
    await admin
      .from("ingestion_runs")
      .update({
        source_version_id: sv.id,
        status: "succeeded",
        completed_at: new Date().toISOString(),
        stats: {
          observations_loaded: observations.length,
          intersections_found: intersectionCount ?? 0,
        },
      })
      .eq("id", run.id);

    await appendChangeLog(ws.id, user.id, "ingestion_runs", run.id, "run_sample_ingestion", null, {
      data_source_id: dataSourceId,
      observations_loaded: observations.length,
      intersections_found: intersectionCount ?? 0,
    });

    revalidatePath(`/app/${workspaceSlug}/sources`);
    return { success: true, runId: run.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";

    await admin
      .from("ingestion_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: msg,
      })
      .eq("id", run.id);

    revalidatePath(`/app/${workspaceSlug}/sources`);
    return { error: msg };
  }
}

// ── Sample data generator ────────────────────────────────────
// Hardcoded sample observations for MVP testing.
// In production these would come from actual files / APIs.

type SampleObservation = {
  external_id: string;
  entity_type: string;
  raw_payload: Record<string, unknown>;
  normalized_payload: Record<string, unknown>;
};

function getSampleObservations(
  category: string,
  _sourceKey: string
): SampleObservation[] {
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
              coordinates: [
                [
                  [-56.0, -4.0],
                  [-55.0, -4.0],
                  [-55.0, -3.0],
                  [-56.0, -3.0],
                  [-56.0, -4.0],
                ],
              ],
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
              coordinates: [
                [
                  [-48.0, -15.0],
                  [-47.0, -15.0],
                  [-47.0, -14.0],
                  [-48.0, -14.0],
                  [-48.0, -15.0],
                ],
              ],
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
              coordinates: [
                [
                  [116.0, 4.0],
                  [117.0, 4.0],
                  [117.0, 5.0],
                  [116.0, 5.0],
                  [116.0, 4.0],
                ],
              ],
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
              coordinates: [
                [
                  [-70.0, -5.0],
                  [-69.0, -5.0],
                  [-69.0, -4.0],
                  [-70.0, -4.0],
                  [-70.0, -5.0],
                ],
              ],
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
              coordinates: [
                [
                  [103.0, -1.0],
                  [104.0, -1.0],
                  [104.0, 0.0],
                  [103.0, 0.0],
                  [103.0, -1.0],
                ],
              ],
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

    default:
      return [];
  }
}
