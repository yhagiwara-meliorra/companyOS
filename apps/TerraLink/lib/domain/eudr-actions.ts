"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/supabase-server";
import { createAdminClient } from "@/lib/db/admin";
import { appendChangeLog } from "@/lib/domain/change-log";
import { parseCsv, validateHeaders, chunk, type CsvRow } from "@/lib/csv";
import { z } from "zod/v4";
import {
  RISK_CRITERION_KEYS,
  RISK_CRITERION_LABELS,
  type RiskCriterionKey,
} from "@/lib/types/eudr";

export type ActionState = { error?: string; success?: boolean };

export type ImportState = {
  error?: string;
  success?: boolean;
  imported?: number;
  failed?: number;
  total?: number;
};

// ── Helpers ─────────────────────────────────────────────────

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function resolveWorkspace(
  admin: ReturnType<typeof createAdminClient>,
  slug: string
) {
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single();
  return ws;
}

// ── Spatial Screening Helper ────────────────────────────────

type SpatialHits = {
  forestHits: number;
  protectedAreaHits: number;
  kbaHits: number;
  totalHits: number;
  closestForestDistanceM: number | null;
  closestProtectedAreaDistanceM: number | null;
};

/**
 * Lookup spatial_intersections for plots' linked sites.
 * Joins: eudr_dds_plots.site_id → workspace_sites.site_id → spatial_intersections.workspace_site_id
 * Then groups by data_sources.category to distinguish forest / protected_area / kba.
 */
async function lookupSpatialHits(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  siteIds: string[]
): Promise<SpatialHits> {
  const empty: SpatialHits = {
    forestHits: 0,
    protectedAreaHits: 0,
    kbaHits: 0,
    totalHits: 0,
    closestForestDistanceM: null,
    closestProtectedAreaDistanceM: null,
  };

  if (siteIds.length === 0) return empty;

  // 1. Get workspace_site_ids for the given site_ids in this workspace
  const { data: wsSites } = await admin
    .from("workspace_sites")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("site_id", siteIds);

  const wsSiteIds = (wsSites ?? []).map((ws) => ws.id);
  if (wsSiteIds.length === 0) return empty;

  // 2. Fetch spatial_intersections with data_source category
  const { data: intersections } = await admin
    .from("spatial_intersections")
    .select(
      `
      id, intersection_type, distance_m,
      data_source:data_sources!data_source_id ( category )
    `
    )
    .in("workspace_site_id", wsSiteIds);

  if (!intersections || intersections.length === 0) return empty;

  // 3. Group by category
  let forestHits = 0;
  let protectedAreaHits = 0;
  let kbaHits = 0;
  let closestForestDistanceM: number | null = null;
  let closestProtectedAreaDistanceM: number | null = null;

  for (const si of intersections) {
    const ds = si.data_source as unknown as { category: string } | null;
    const category = ds?.category;
    const dist = si.distance_m != null ? Number(si.distance_m) : null;

    if (category === "forest" || category === "land_cover") {
      forestHits++;
      if (dist != null && (closestForestDistanceM === null || dist < closestForestDistanceM)) {
        closestForestDistanceM = dist;
      }
    } else if (category === "protected_area") {
      protectedAreaHits++;
      if (dist != null && (closestProtectedAreaDistanceM === null || dist < closestProtectedAreaDistanceM)) {
        closestProtectedAreaDistanceM = dist;
      }
    } else if (category === "kba") {
      kbaHits++;
    }
  }

  return {
    forestHits,
    protectedAreaHits,
    kbaHits,
    totalHits: intersections.length,
    closestForestDistanceM,
    closestProtectedAreaDistanceM,
  };
}

// ── Schemas ─────────────────────────────────────────────────

const DdsStatementSchema = z.object({
  operatorOrgId: z.string().uuid("オペレーター組織を選択してください"),
  internalReference: z.string().min(1, "内部参照番号は必須です"),
  operatorType: z
    .enum(["operator", "non_sme_trader", "sme_trader"])
    .default("operator"),
  countryOfActivity: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

const ProductLineSchema = z.object({
  ddsId: z.string().uuid(),
  commodityType: z.enum([
    "cattle",
    "cocoa",
    "coffee",
    "oil_palm",
    "rubber",
    "soya",
    "wood",
  ]),
  cnCode: z.string().min(1, "CNコードは必須です"),
  productDescription: z.string().min(1, "製品説明は必須です"),
  countryOfProduction: z.string().min(1, "生産国は必須です"),
  quantityKg: z.coerce.number().positive().optional(),
  hsCode: z.string().optional(),
  tradeName: z.string().optional(),
  scientificName: z.string().optional(),
});

const PlotSchema = z.object({
  productLineId: z.string().uuid(),
  geolocationType: z.enum(["point", "polygon"]).default("point"),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  geojson: z.string().optional(),
  areaHa: z.coerce.number().positive().optional(),
  countryOfProduction: z.string().min(1, "生産国は必須です"),
  region: z.string().optional(),
  productionStartDate: z.string().optional(),
  productionEndDate: z.string().optional(),
  siteId: z.string().uuid().optional(),
  plotReference: z.string().optional(),
});

const UpstreamRefSchema = z.object({
  ddsId: z.string().uuid(),
  referenceNumber: z.string().min(1, "参照番号は必須です"),
  verificationNumber: z.string().optional(),
  upstreamOperatorName: z.string().optional(),
  upstreamEori: z.string().optional(),
  upstreamCountry: z.string().optional(),
  commodityType: z.string().optional(),
  notes: z.string().optional(),
});

const MitigationSchema = z.object({
  riskAssessmentId: z.string().uuid(),
  criterionKey: z.string().optional(),
  mitigationType: z.string().min(1, "軽減措置の種類は必須です"),
  description: z.string().min(1, "説明は必須です"),
  evidenceItemId: z.string().uuid().optional(),
});

// ── Helpers: Country Risk Resolution ────────────────────────

/**
 * Resolve country risk tier with commodity-specific fallback.
 * Lookup order: country|commodity → country → "standard"
 */
function resolveCountryRisk(
  countryRiskMap: Record<string, string>,
  country: string,
  commodity?: string
): string {
  if (commodity) {
    const specific = countryRiskMap[`${country}|${commodity}`];
    if (specific) return specific;
  }
  return countryRiskMap[country] ?? "standard";
}

// ── DDS Statement CRUD ──────────────────────────────────────

export async function createDdsStatement(
  workspaceSlug: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState & { ddsId?: string }> {
  const user = await requireAuth();
  if (!user) return { error: "認証が必要です" };

  const parsed = DdsStatementSchema.safeParse({
    operatorOrgId: formData.get("operatorOrgId"),
    internalReference: formData.get("internalReference"),
    operatorType: formData.get("operatorType") || "operator",
    countryOfActivity: formData.get("countryOfActivity") || undefined,
    description: formData.get("description") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (!ws) return { error: "ワークスペースが見つかりません" };

  const { data: dds, error } = await admin
    .from("eudr_dds_statements")
    .insert({
      workspace_id: ws.id,
      operator_org_id: parsed.data.operatorOrgId,
      internal_reference: parsed.data.internalReference,
      operator_type: parsed.data.operatorType,
      status: "draft",
      country_of_activity: parsed.data.countryOfActivity || null,
      description: parsed.data.description || null,
      notes: parsed.data.notes || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await appendChangeLog(
    ws.id,
    user.id,
    "eudr_dds_statements",
    dds.id,
    "insert",
    null,
    {
      internal_reference: parsed.data.internalReference,
      operator_type: parsed.data.operatorType,
    }
  );

  revalidatePath(`/app/${workspaceSlug}/eudr`);
  return { success: true, ddsId: dds.id };
}

export async function updateDdsStatement(
  workspaceSlug: string,
  ddsId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "認証が必要です" };

  const admin = createAdminClient();
  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (!ws) return { error: "ワークスペースが見つかりません" };

  const updates: Record<string, unknown> = {};
  const desc = formData.get("description");
  const notes = formData.get("notes");
  const countryOfActivity = formData.get("countryOfActivity");
  const operatorType = formData.get("operatorType");

  if (desc !== null) updates.description = desc || null;
  if (notes !== null) updates.notes = notes || null;
  if (countryOfActivity !== null)
    updates.country_of_activity = countryOfActivity || null;
  if (operatorType) updates.operator_type = operatorType;

  const { error } = await admin
    .from("eudr_dds_statements")
    .update(updates)
    .eq("id", ddsId)
    .eq("workspace_id", ws.id);

  if (error) return { error: error.message };

  await appendChangeLog(
    ws.id,
    user.id,
    "eudr_dds_statements",
    ddsId,
    "update",
    null,
    updates
  );

  revalidatePath(`/app/${workspaceSlug}/eudr`);
  return { success: true };
}

export async function updateDdsStatus(
  workspaceSlug: string,
  ddsId: string,
  newStatus: string
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "認証が必要です" };

  const admin = createAdminClient();
  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (!ws) return { error: "ワークスペースが見つかりません" };

  // Get current state
  const { data: current } = await admin
    .from("eudr_dds_statements")
    .select("status")
    .eq("id", ddsId)
    .single();

  const updates: Record<string, unknown> = { status: newStatus };
  if (newStatus === "submitted") {
    updates.submission_date = new Date().toISOString().split("T")[0];
  }

  const { error } = await admin
    .from("eudr_dds_statements")
    .update(updates)
    .eq("id", ddsId)
    .eq("workspace_id", ws.id);

  if (error) return { error: error.message };

  const action =
    newStatus === "submitted"
      ? "dds_submit"
      : newStatus === "withdrawn"
        ? "dds_withdraw"
        : "status_change";

  await appendChangeLog(
    ws.id,
    user.id,
    "eudr_dds_statements",
    ddsId,
    action,
    { status: current?.status },
    { status: newStatus }
  );

  revalidatePath(`/app/${workspaceSlug}/eudr`);
  return { success: true };
}

// ── Product Line CRUD ───────────────────────────────────────

export async function createProductLine(
  workspaceSlug: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "認証が必要です" };

  const parsed = ProductLineSchema.safeParse({
    ddsId: formData.get("ddsId"),
    commodityType: formData.get("commodityType"),
    cnCode: formData.get("cnCode"),
    productDescription: formData.get("productDescription"),
    countryOfProduction: formData.get("countryOfProduction"),
    quantityKg: formData.get("quantityKg") || undefined,
    hsCode: formData.get("hsCode") || undefined,
    tradeName: formData.get("tradeName") || undefined,
    scientificName: formData.get("scientificName") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (!ws) return { error: "ワークスペースが見つかりません" };

  // Find matching commodity code
  const { data: cc } = await admin
    .from("eudr_commodity_codes")
    .select("id")
    .eq("cn_code", parsed.data.cnCode)
    .eq("is_active", true)
    .order("cn_year", { ascending: false })
    .limit(1)
    .single();

  const { error } = await admin.from("eudr_dds_product_lines").insert({
    dds_id: parsed.data.ddsId,
    commodity_code_id: cc?.id ?? null,
    commodity_type: parsed.data.commodityType,
    cn_code: parsed.data.cnCode,
    product_description: parsed.data.productDescription,
    country_of_production: parsed.data.countryOfProduction,
    quantity_kg: parsed.data.quantityKg ?? null,
    hs_code: parsed.data.hsCode || null,
    trade_name: parsed.data.tradeName || null,
    scientific_name: parsed.data.scientificName || null,
  });

  if (error) return { error: error.message };

  await appendChangeLog(
    ws.id,
    user.id,
    "eudr_dds_product_lines",
    parsed.data.ddsId,
    "insert",
    null,
    { cn_code: parsed.data.cnCode, commodity_type: parsed.data.commodityType }
  );

  revalidatePath(`/app/${workspaceSlug}/eudr`);
  return { success: true };
}

// ── Plot CRUD ───────────────────────────────────────────────

export async function createPlot(
  workspaceSlug: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState & { spatialHits?: SpatialHits }> {
  const user = await requireAuth();
  if (!user) return { error: "認証が必要です" };

  const parsed = PlotSchema.safeParse({
    productLineId: formData.get("productLineId"),
    geolocationType: formData.get("geolocationType") || "point",
    latitude: formData.get("latitude") || undefined,
    longitude: formData.get("longitude") || undefined,
    geojson: formData.get("geojson") || undefined,
    areaHa: formData.get("areaHa") || undefined,
    countryOfProduction: formData.get("countryOfProduction"),
    region: formData.get("region") || undefined,
    productionStartDate: formData.get("productionStartDate") || undefined,
    productionEndDate: formData.get("productionEndDate") || undefined,
    siteId: formData.get("siteId") || undefined,
    plotReference: formData.get("plotReference") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (!ws) return { error: "ワークスペースが見つかりません" };

  const insertData: Record<string, unknown> = {
    product_line_id: parsed.data.productLineId,
    geolocation_type: parsed.data.geolocationType,
    latitude: parsed.data.latitude ?? null,
    longitude: parsed.data.longitude ?? null,
    area_ha: parsed.data.areaHa ?? null,
    country_of_production: parsed.data.countryOfProduction,
    region: parsed.data.region || null,
    production_start_date: parsed.data.productionStartDate || null,
    production_end_date: parsed.data.productionEndDate || null,
    site_id: parsed.data.siteId || null,
    plot_reference: parsed.data.plotReference || null,
    verification_status: "declared",
  };

  // Handle GeoJSON for polygon plots
  if (parsed.data.geojson) {
    try {
      insertData.geojson = JSON.parse(parsed.data.geojson);
    } catch {
      return { error: "GeoJSON の形式が不正です" };
    }
  }

  const { error } = await admin.from("eudr_dds_plots").insert(insertData);

  if (error) return { error: error.message };

  await appendChangeLog(
    ws.id,
    user.id,
    "eudr_dds_plots",
    parsed.data.productLineId,
    "insert",
    null,
    {
      country_of_production: parsed.data.countryOfProduction,
      geolocation_type: parsed.data.geolocationType,
    }
  );

  // Post-insert: check spatial intersections if plot is linked to a site
  let spatialHits: SpatialHits | undefined;
  if (parsed.data.siteId) {
    spatialHits = await lookupSpatialHits(admin, ws.id, [parsed.data.siteId]);
  }

  revalidatePath(`/app/${workspaceSlug}/eudr`);
  return { success: true, spatialHits };
}

// ── Upstream Ref CRUD ───────────────────────────────────────

export async function createUpstreamRef(
  workspaceSlug: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "認証が必要です" };

  const parsed = UpstreamRefSchema.safeParse({
    ddsId: formData.get("ddsId"),
    referenceNumber: formData.get("referenceNumber"),
    verificationNumber: formData.get("verificationNumber") || undefined,
    upstreamOperatorName: formData.get("upstreamOperatorName") || undefined,
    upstreamEori: formData.get("upstreamEori") || undefined,
    upstreamCountry: formData.get("upstreamCountry") || undefined,
    commodityType: formData.get("commodityType") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (!ws) return { error: "ワークスペースが見つかりません" };

  const { error } = await admin.from("eudr_dds_upstream_refs").insert({
    dds_id: parsed.data.ddsId,
    reference_number: parsed.data.referenceNumber,
    verification_number: parsed.data.verificationNumber || null,
    upstream_operator_name: parsed.data.upstreamOperatorName || null,
    upstream_eori: parsed.data.upstreamEori || null,
    upstream_country: parsed.data.upstreamCountry || null,
    commodity_type: parsed.data.commodityType || null,
    notes: parsed.data.notes || null,
  });

  if (error) return { error: error.message };

  await appendChangeLog(
    ws.id,
    user.id,
    "eudr_dds_upstream_refs",
    parsed.data.ddsId,
    "insert",
    null,
    { reference_number: parsed.data.referenceNumber }
  );

  revalidatePath(`/app/${workspaceSlug}/eudr`);
  return { success: true };
}

// ── Risk Assessment ─────────────────────────────────────────

export async function createOrUpdateRiskAssessment(
  workspaceSlug: string,
  ddsId: string
): Promise<ActionState & { assessmentId?: string }> {
  const user = await requireAuth();
  if (!user) return { error: "認証が必要です" };

  const admin = createAdminClient();
  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (!ws) return { error: "ワークスペースが見つかりません" };

  // Check if assessment already exists
  const { data: existing } = await admin
    .from("eudr_risk_assessments")
    .select("id")
    .eq("dds_id", ddsId)
    .single();

  if (existing) {
    // Run auto-scoring on existing assessment
    await runAutoScoring(admin, ws.id, ddsId, existing.id);
    revalidatePath(`/app/${workspaceSlug}/eudr`);
    return { success: true, assessmentId: existing.id };
  }

  // Create new assessment
  const { data: assessment, error } = await admin
    .from("eudr_risk_assessments")
    .insert({
      workspace_id: ws.id,
      dds_id: ddsId,
      overall_result: "pending",
      status: "draft",
      assessed_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Create 14 criteria rows
  const criteriaRows = RISK_CRITERION_KEYS.map((key) => ({
    risk_assessment_id: assessment.id,
    criterion_key: key,
    criterion_label: RISK_CRITERION_LABELS[key as RiskCriterionKey],
  }));

  await admin.from("eudr_risk_criteria").insert(criteriaRows);

  // Run auto-scoring
  await runAutoScoring(admin, ws.id, ddsId, assessment.id);

  await appendChangeLog(
    ws.id,
    user.id,
    "eudr_risk_assessments",
    assessment.id,
    "insert",
    null,
    { dds_id: ddsId }
  );

  revalidatePath(`/app/${workspaceSlug}/eudr`);
  return { success: true, assessmentId: assessment.id };
}

async function runAutoScoring(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  ddsId: string,
  assessmentId: string
) {
  // Fetch DDS with product lines and plots
  const { data: dds } = await admin
    .from("eudr_dds_statements")
    .select("id, status")
    .eq("id", ddsId)
    .single();

  if (!dds) return;

  const { data: productLines } = await admin
    .from("eudr_dds_product_lines")
    .select("id, commodity_type, cn_code, country_of_production")
    .eq("dds_id", ddsId);

  const { data: plots } = await admin
    .from("eudr_dds_plots")
    .select(
      "id, product_line_id, site_id, latitude, longitude, geolocation_type, area_ha, country_of_production, production_start_date, production_end_date, geojson"
    )
    .in(
      "product_line_id",
      (productLines ?? []).map((pl) => pl.id)
    );

  const { data: upstreamRefs } = await admin
    .from("eudr_dds_upstream_refs")
    .select("id, reference_number, verification_number")
    .eq("dds_id", ddsId);

  // Country risk lookup
  const countries = [
    ...new Set(
      (productLines ?? []).map((pl) => pl.country_of_production).filter(Boolean)
    ),
  ];
  const { data: benchmarks } = await admin
    .from("eudr_country_benchmarks")
    .select("country_code, risk_tier, commodity_type")
    .in("country_code", countries)
    .is("superseded_at", null);

  const countryRiskMap: Record<string, string> = {};
  for (const b of benchmarks ?? []) {
    if (b.commodity_type) {
      // Commodity-specific key: "BR|cattle"
      countryRiskMap[`${b.country_code}|${b.commodity_type}`] = b.risk_tier;
    } else {
      // Generic key: "BR"
      countryRiskMap[b.country_code] = b.risk_tier;
    }
  }

  // Determine highest country risk (commodity-aware per product line)
  let maxCountryRisk: string = "low";
  for (const pl of productLines ?? []) {
    const tier = resolveCountryRisk(
      countryRiskMap,
      pl.country_of_production,
      pl.commodity_type
    );
    if (tier === "high") maxCountryRisk = "high";
    else if (tier === "standard" && maxCountryRisk !== "high")
      maxCountryRisk = "standard";
  }

  // Auto-score each criterion
  const scores: Record<string, string> = {};

  // (a) Geolocation missing
  const plotsWithoutGeo = (plots ?? []).filter(
    (p) =>
      p.geolocation_type === "point" &&
      (p.latitude == null || p.longitude == null)
  );
  const hasPolygonWithoutGeojson = (plots ?? []).filter(
    (p) => p.geolocation_type === "polygon" && !p.geojson
  );
  scores.a =
    plotsWithoutGeo.length > 0 || hasPolygonWithoutGeojson.length > 0
      ? "high"
      : (plots ?? []).length === 0
        ? "medium"
        : "low";

  // (b) Plot geometry invalid
  scores.b =
    (plots ?? []).length === 0
      ? "medium"
      : plotsWithoutGeo.length > 0
        ? "medium"
        : "low";

  // (c) Production period missing
  const plotsWithoutDates = (plots ?? []).filter(
    (p) => !p.production_start_date || !p.production_end_date
  );
  scores.c =
    plotsWithoutDates.length > 0 && (plots ?? []).length > 0
      ? "high"
      : (plots ?? []).length === 0
        ? "medium"
        : "low";

  // (d) Legality evidence missing — check evidence_links
  const { count: evidenceCount } = await admin
    .from("evidence_links")
    .select("id", { count: "exact", head: true })
    .eq("target_type", "dds_statement")
    .eq("target_id", ddsId);
  scores.d = (evidenceCount ?? 0) === 0 ? "high" : "low";

  // (e) Commodity mapping incomplete
  const unmappedLines = (productLines ?? []).filter(
    (pl) => !pl.cn_code || !pl.commodity_type
  );
  scores.e = unmappedLines.length > 0 ? "high" : "low";

  // (f) Country risk not mapped (commodity-aware)
  const unmappedCountries = countries.filter((c) => !countryRiskMap[c]);
  const hasUnmappedCommodityRisk = (productLines ?? []).some(
    (pl) =>
      pl.country_of_production &&
      pl.commodity_type &&
      !countryRiskMap[`${pl.country_of_production}|${pl.commodity_type}`] &&
      !countryRiskMap[pl.country_of_production]
  );
  scores.f =
    unmappedCountries.length > 0 || hasUnmappedCommodityRisk
      ? "medium"
      : maxCountryRisk === "high"
        ? "high"
        : maxCountryRisk === "standard"
          ? "medium"
          : "low";

  // (g) Upstream DDS reference inconsistency
  const unverifiedRefs = (upstreamRefs ?? []).filter(
    (r) => !r.verification_number
  );
  scores.g =
    unverifiedRefs.length > 0
      ? "medium"
      : (upstreamRefs ?? []).length === 0
        ? "low"
        : "low";

  // (h) Deforestation screening — use spatial_intersections for forest/land_cover hits
  // (i) Forest degradation — same spatial data, slightly different threshold
  // (j) Protected area overlap — use spatial_intersections for protected_area hits
  const plotSiteIds = (plots ?? [])
    .map((p) => p.site_id)
    .filter((id): id is string => id != null);
  const spatialHits = await lookupSpatialHits(admin, workspaceId, plotSiteIds);

  // (h) Deforestation screening
  if (spatialHits.forestHits > 0) {
    // Direct spatial intersection with forest/land_cover layer
    const closeHit = spatialHits.closestForestDistanceM;
    scores.h = closeHit !== null && closeHit <= 0 ? "high" : "high";
  } else if (maxCountryRisk === "high") {
    // Fallback: high-risk country but no spatial data ingested yet
    scores.h = "medium";
  } else {
    scores.h = "low";
  }

  // (i) Forest degradation
  if (spatialHits.forestHits > 0) {
    const closeHit = spatialHits.closestForestDistanceM;
    scores.i = closeHit !== null && closeHit <= 5000 ? "high" : "medium";
  } else if (maxCountryRisk === "high") {
    scores.i = "medium";
  } else {
    scores.i = "low";
  }

  // (j) Protected area overlap
  if (spatialHits.protectedAreaHits > 0 || spatialHits.kbaHits > 0) {
    const closeHit = spatialHits.closestProtectedAreaDistanceM;
    scores.j = closeHit !== null && closeHit <= 0 ? "high" : "medium";
  } else {
    scores.j = "low";
  }

  // (k) Indigenous rights
  scores.k = maxCountryRisk === "high" ? "medium" : "low";

  // (l) Supply chain complexity
  scores.l =
    (upstreamRefs ?? []).length > 3
      ? "high"
      : (upstreamRefs ?? []).length > 1
        ? "medium"
        : "low";

  // (m) Corruption perception
  scores.m = maxCountryRisk === "high" ? "high" : "low";

  // (n) Sanctions/conflict — currently defaults to "low" pending
  // external sanctions list API integration (OFAC, EU Consolidated List).
  // TODO: Integrate sanctions screening service and populate from real data.
  scores.n = maxCountryRisk === "high" ? "medium" : "low";

  // Determine overall result
  const hasHigh = Object.values(scores).includes("high");
  const hasMediumWithComplexity =
    Object.values(scores).filter((s) => s === "medium").length >= 3;
  const overallResult =
    hasHigh || hasMediumWithComplexity ? "non_negligible" : "negligible";

  // Update criteria
  for (const key of RISK_CRITERION_KEYS) {
    await admin
      .from("eudr_risk_criteria")
      .update({
        auto_score: scores[key] || null,
        final_score: scores[key] || null,
      })
      .eq("risk_assessment_id", assessmentId)
      .eq("criterion_key", key);
  }

  // Update assessment
  await admin
    .from("eudr_risk_assessments")
    .update({
      overall_result: overallResult,
      country_risk_level: maxCountryRisk,
      auto_score_json: scores,
      assessed_at: new Date().toISOString(),
    })
    .eq("id", assessmentId);
}

export async function updateRiskCriterion(
  workspaceSlug: string,
  criterionId: string,
  manualOverride: string,
  evidenceNotes: string
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "認証が必要です" };

  const admin = createAdminClient();
  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (!ws) return { error: "ワークスペースが見つかりません" };

  const { error } = await admin
    .from("eudr_risk_criteria")
    .update({
      manual_override: manualOverride || null,
      final_score: manualOverride || null,
      evidence_notes: evidenceNotes || null,
    })
    .eq("id", criterionId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/eudr`);
  return { success: true };
}

// ── Mitigation Actions ──────────────────────────────────────

export async function createMitigation(
  workspaceSlug: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "認証が必要です" };

  const parsed = MitigationSchema.safeParse({
    riskAssessmentId: formData.get("riskAssessmentId"),
    criterionKey: formData.get("criterionKey") || undefined,
    mitigationType: formData.get("mitigationType"),
    description: formData.get("description"),
    evidenceItemId: formData.get("evidenceItemId") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (!ws) return { error: "ワークスペースが見つかりません" };

  const { error } = await admin.from("eudr_risk_mitigations").insert({
    risk_assessment_id: parsed.data.riskAssessmentId,
    criterion_key: parsed.data.criterionKey || null,
    mitigation_type: parsed.data.mitigationType,
    description: parsed.data.description,
    evidence_item_id: parsed.data.evidenceItemId || null,
    status: "planned",
  });

  if (error) return { error: error.message };

  await appendChangeLog(
    ws.id,
    user.id,
    "eudr_risk_mitigations",
    parsed.data.riskAssessmentId,
    "insert",
    null,
    {
      mitigation_type: parsed.data.mitigationType,
      criterion_key: parsed.data.criterionKey,
    }
  );

  revalidatePath(`/app/${workspaceSlug}/eudr`);
  return { success: true };
}

// ── Soft Delete DDS ─────────────────────────────────────────

export async function deleteDdsStatement(
  workspaceSlug: string,
  ddsId: string
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "認証が必要です" };

  const admin = createAdminClient();
  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (!ws) return { error: "ワークスペースが見つかりません" };

  const { error } = await admin
    .from("eudr_dds_statements")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", ddsId)
    .eq("workspace_id", ws.id);

  if (error) return { error: error.message };

  await appendChangeLog(
    ws.id,
    user.id,
    "eudr_dds_statements",
    ddsId,
    "soft_delete"
  );

  revalidatePath(`/app/${workspaceSlug}/eudr`);
  return { success: true };
}

// ── CSV Import: Plots ────────────────────────────────────────
// Batch import production plots for a specific DDS product line.
// Required CSV headers: country_of_production
// Optional: geolocation_type, latitude, longitude, geojson, area_ha,
//   region, production_start_date, production_end_date, plot_reference, site_id

const BATCH_SIZE = 200;

export async function importPlotsCsv(
  workspaceSlug: string,
  productLineId: string,
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "認証されていません。ログインしてください。" };

  const file = formData.get("file") as File | null;
  if (!file) return { error: "ファイルが選択されていません" };
  if (file.size > 10 * 1024 * 1024) return { error: "ファイルサイズが大きすぎます（上限 10 MB）" };

  const text = await file.text();
  const { headers, rows } = parseCsv(text);

  if (rows.length === 0) return { error: "CSVにデータ行がありません" };

  const missing = validateHeaders(headers, ["country_of_production"]);
  if (missing.length > 0)
    return { error: `必須カラムが不足しています: ${missing.join(", ")}` };

  const admin = createAdminClient();
  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (!ws) return { error: "ワークスペースが見つかりません" };

  // Verify product line exists and belongs to a DDS in this workspace
  const { data: pl } = await admin
    .from("eudr_dds_product_lines")
    .select("id, dds_id")
    .eq("id", productLineId)
    .single();

  if (!pl) return { error: "製品ラインが見つかりません" };

  const { data: ddsCheck } = await admin
    .from("eudr_dds_statements")
    .select("id")
    .eq("id", pl.dds_id)
    .eq("workspace_id", ws.id)
    .is("deleted_at", null)
    .single();

  if (!ddsCheck) return { error: "DDSが見つからないか、アクセス権がありません" };

  let imported = 0;
  let failed = 0;
  const errors: string[] = [];
  const chunks = chunk(rows, BATCH_SIZE);

  for (let ci = 0; ci < chunks.length; ci++) {
    const batch = chunks[ci];
    const batchOffset = ci * BATCH_SIZE + 2;

    const plotPayloads = batch.map((row) => buildPlotPayload(row, productLineId));

    const { data: insertedPlots, error: plotErr } = await admin
      .from("eudr_dds_plots")
      .insert(plotPayloads)
      .select("id");

    if (plotErr || !insertedPlots) {
      // Fallback to row-by-row
      const rowResults = await insertPlotRowByRow(admin, batch, productLineId, batchOffset);
      imported += rowResults.imported;
      failed += rowResults.failed;
      errors.push(...rowResults.errors);
      continue;
    }

    imported += insertedPlots.length;
  }

  if (imported > 0) {
    await appendChangeLog(ws.id, user.id, "eudr_dds_plots", productLineId, "insert", null, {
      action: "csv_import",
      imported,
      failed,
      total: rows.length,
    });
  }

  revalidatePath(`/app/${workspaceSlug}/eudr`);

  if (errors.length > 0) {
    return {
      error: `${imported}/${rows.length}件インポート済み。${errors.length}件のエラー: ${errors.slice(0, 3).join("; ")}`,
      imported,
      failed,
      total: rows.length,
    };
  }
  return { success: true, imported, total: rows.length };
}

function buildPlotPayload(row: CsvRow, productLineId: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    product_line_id: productLineId,
    geolocation_type: row.geolocation_type || "point",
    latitude: row.latitude ? parseFloat(row.latitude) : null,
    longitude: row.longitude ? parseFloat(row.longitude) : null,
    area_ha: row.area_ha ? parseFloat(row.area_ha) : null,
    country_of_production: row.country_of_production,
    region: row.region || null,
    production_start_date: row.production_start_date || null,
    production_end_date: row.production_end_date || null,
    site_id: row.site_id || null,
    plot_reference: row.plot_reference || null,
    verification_status: "inferred" as const,
  };

  if (row.geojson) {
    try {
      payload.geojson = JSON.parse(row.geojson);
    } catch {
      // Skip invalid GeoJSON, leave as null
    }
  }

  return payload;
}

async function insertPlotRowByRow(
  admin: ReturnType<typeof createAdminClient>,
  rows: CsvRow[],
  productLineId: string,
  startRowNum: number
) {
  let imported = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = startRowNum + i;

    const { error: plotErr } = await admin
      .from("eudr_dds_plots")
      .insert(buildPlotPayload(row, productLineId));

    if (plotErr) {
      errors.push(`行 ${rowNum}: ${plotErr.message}`);
      failed++;
      continue;
    }

    imported++;
  }

  return { imported, failed, errors };
}

// ── CSV Import: Cattle Establishments ────────────────────────
// Batch import cattle establishment chains.
// Required CSV headers: cattle_animal_id, establishment_type, country_code
// Optional: establishment_name, latitude, longitude, region, date_entered,
//   date_left, sequence_order, site_id, notes

export async function importCattleEstablishmentsCsv(
  workspaceSlug: string,
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "認証されていません。ログインしてください。" };

  const file = formData.get("file") as File | null;
  if (!file) return { error: "ファイルが選択されていません" };
  if (file.size > 10 * 1024 * 1024) return { error: "ファイルサイズが大きすぎます（上限 10 MB）" };

  const text = await file.text();
  const { headers, rows } = parseCsv(text);

  if (rows.length === 0) return { error: "CSVにデータ行がありません" };

  const missing = validateHeaders(headers, [
    "cattle_animal_id",
    "establishment_type",
    "country_code",
  ]);
  if (missing.length > 0)
    return { error: `必須カラムが不足しています: ${missing.join(", ")}` };

  const admin = createAdminClient();
  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (!ws) return { error: "ワークスペースが見つかりません" };

  // Verify all referenced cattle_animal_ids belong to this workspace's DDS
  const animalIds = [...new Set(rows.map((r) => r.cattle_animal_id).filter(Boolean))];
  if (animalIds.length === 0) return { error: "cattle_animal_id が空です" };

  const { data: validAnimals } = await admin
    .from("eudr_dds_cattle_animals")
    .select(`
      id,
      product_line:eudr_dds_product_lines!product_line_id (
        dds:eudr_dds_statements!dds_id ( workspace_id )
      )
    `)
    .in("id", animalIds);

  const validAnimalIds = new Set(
    (validAnimals ?? [])
      .filter((a) => {
        const pl = a.product_line as unknown as {
          dds: { workspace_id: string } | null;
        } | null;
        return pl?.dds?.workspace_id === ws.id;
      })
      .map((a) => a.id)
  );

  if (validAnimalIds.size === 0)
    return { error: "有効な cattle_animal_id が見つかりません。DDSがこのワークスペースに属しているか確認してください。" };

  const validEstTypes = new Set([
    "birthplace",
    "rearing_farm",
    "feeding_facility",
    "grazing_land",
    "slaughterhouse",
  ]);

  let imported = 0;
  let failed = 0;
  const errors: string[] = [];
  const chunks = chunk(rows, BATCH_SIZE);

  for (let ci = 0; ci < chunks.length; ci++) {
    const batch = chunks[ci];
    const batchOffset = ci * BATCH_SIZE + 2;

    const payloads = batch
      .map((row, idx) => {
        if (!validAnimalIds.has(row.cattle_animal_id)) {
          errors.push(`行 ${batchOffset + idx}: 無効な cattle_animal_id`);
          failed++;
          return null;
        }
        const estType = row.establishment_type;
        if (!validEstTypes.has(estType)) {
          errors.push(`行 ${batchOffset + idx}: 無効な establishment_type "${estType}"`);
          failed++;
          return null;
        }
        return buildCattleEstPayload(row);
      })
      .filter((p): p is Record<string, unknown> => p !== null);

    if (payloads.length === 0) continue;

    const { data: inserted, error: insertErr } = await admin
      .from("eudr_dds_cattle_establishments")
      .insert(payloads)
      .select("id");

    if (insertErr || !inserted) {
      // Fallback to row-by-row
      const validBatch = batch.filter(
        (r) => validAnimalIds.has(r.cattle_animal_id) && validEstTypes.has(r.establishment_type)
      );
      const rowResults = await insertCattleEstRowByRow(admin, validBatch, batchOffset);
      imported += rowResults.imported;
      failed += rowResults.failed;
      errors.push(...rowResults.errors);
      continue;
    }

    imported += inserted.length;
  }

  if (imported > 0) {
    await appendChangeLog(ws.id, user.id, "eudr_dds_cattle_establishments", ws.id, "insert", null, {
      action: "csv_import",
      imported,
      failed,
      total: rows.length,
    });
  }

  revalidatePath(`/app/${workspaceSlug}/eudr`);

  if (errors.length > 0) {
    return {
      error: `${imported}/${rows.length}件インポート済み。${errors.length}件のエラー: ${errors.slice(0, 3).join("; ")}`,
      imported,
      failed,
      total: rows.length,
    };
  }
  return { success: true, imported, total: rows.length };
}

function buildCattleEstPayload(row: CsvRow): Record<string, unknown> {
  return {
    cattle_animal_id: row.cattle_animal_id,
    establishment_type: row.establishment_type,
    establishment_name: row.establishment_name || null,
    latitude: row.latitude ? parseFloat(row.latitude) : null,
    longitude: row.longitude ? parseFloat(row.longitude) : null,
    country_code: row.country_code,
    region: row.region || null,
    date_entered: row.date_entered || null,
    date_left: row.date_left || null,
    sequence_order: row.sequence_order ? parseInt(row.sequence_order, 10) : 0,
    site_id: row.site_id || null,
    notes: row.notes || null,
  };
}

async function insertCattleEstRowByRow(
  admin: ReturnType<typeof createAdminClient>,
  rows: CsvRow[],
  startRowNum: number
) {
  let imported = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = startRowNum + i;

    const { error: insertErr } = await admin
      .from("eudr_dds_cattle_establishments")
      .insert(buildCattleEstPayload(row));

    if (insertErr) {
      errors.push(`行 ${rowNum}: ${insertErr.message}`);
      failed++;
      continue;
    }

    imported++;
  }

  return { imported, failed, errors };
}
