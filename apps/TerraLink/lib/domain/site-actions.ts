"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/supabase-server";
import { createAdminClient } from "@/lib/db/admin";
import { z } from "zod/v4";

// ── Schemas ─────────────────────────────────────────────────
const SiteSchema = z.object({
  name: z.string().min(1, "サイト名は必須です"),
  siteType: z.enum([
    "farm",
    "plantation",
    "factory",
    "warehouse",
    "port",
    "mine",
    "office",
    "other",
  ]),
  countryCode: z.string().max(3).optional(),
  regionAdmin1: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  areaHa: z.coerce.number().min(0).optional(),
  address: z.string().optional(),
});

export type ActionState = { error?: string; success?: boolean };

// ── Create Site ─────────────────────────────────────────────
export async function createSite(
  workspaceSlug: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "認証されていません。ログインしてください。" };

  const parsed = SiteSchema.safeParse({
    name: formData.get("name"),
    siteType: formData.get("siteType"),
    countryCode: formData.get("countryCode") || undefined,
    regionAdmin1: formData.get("regionAdmin1") || undefined,
    lat: formData.get("lat") || undefined,
    lng: formData.get("lng") || undefined,
    areaHa: formData.get("areaHa") || undefined,
    address: formData.get("address") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, siteType, countryCode, regionAdmin1, lat, lng, areaHa, address } =
    parsed.data;

  const admin = createAdminClient();

  // Get workspace
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .is("deleted_at", null)
    .single();
  if (!ws) return { error: "ワークスペースが見つかりません" };

  // Need an organization_id — get the first org linked to this workspace
  // For site creation, the org must be provided
  const orgId = formData.get("organizationId") as string | null;
  if (!orgId) return { error: "組織の選択は必須です" };

  // Create site
  const { data: site, error: siteErr } = await admin
    .from("sites")
    .insert({
      name,
      site_type: siteType,
      country_code: countryCode || null,
      region_admin1: regionAdmin1 || null,
      lat: lat ?? null,
      lng: lng ?? null,
      area_ha: areaHa ?? null,
      address: address || null,
    })
    .select("id")
    .single();

  if (siteErr || !site) return { error: siteErr?.message ?? "サイトの作成に失敗しました" };

  // Link site to organization
  const { error: orgSiteErr } = await admin
    .from("organization_sites")
    .insert({
      organization_id: orgId,
      site_id: site.id,
      role: "operator",
    });

  if (orgSiteErr) return { error: orgSiteErr.message };

  // Link site to workspace
  const { error: wsSiteErr } = await admin
    .from("workspace_sites")
    .insert({
      workspace_id: ws.id,
      site_id: site.id,
      visibility: "full",
    });

  if (wsSiteErr) return { error: wsSiteErr.message };

  revalidatePath(`/app/${workspaceSlug}/sites`);
  return { success: true };
}

// ── Update Site ─────────────────────────────────────────────
export async function updateSite(
  workspaceSlug: string,
  siteId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "認証されていません。ログインしてください。" };

  const parsed = SiteSchema.safeParse({
    name: formData.get("name"),
    siteType: formData.get("siteType"),
    countryCode: formData.get("countryCode") || undefined,
    regionAdmin1: formData.get("regionAdmin1") || undefined,
    lat: formData.get("lat") || undefined,
    lng: formData.get("lng") || undefined,
    areaHa: formData.get("areaHa") || undefined,
    address: formData.get("address") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { error } = await admin
    .from("sites")
    .update({
      name: parsed.data.name,
      site_type: parsed.data.siteType,
      country_code: parsed.data.countryCode || null,
      region_admin1: parsed.data.regionAdmin1 || null,
      lat: parsed.data.lat ?? null,
      lng: parsed.data.lng ?? null,
      area_ha: parsed.data.areaHa ?? null,
      address: parsed.data.address || null,
    })
    .eq("id", siteId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/sites`);
  return { success: true };
}

// ── CSV Import Sites (batch) ────────────────────────────────
// Handles up to ~2000 rows via chunked batch inserts.
// Each chunk: 1 bulk INSERT sites → 1 bulk INSERT org_sites → 1 bulk INSERT ws_sites
// ≈ 15 queries for 1000 rows (vs 3000+ row-by-row).

import { parseCsv, validateHeaders, chunk, type CsvRow } from "@/lib/csv";

const BATCH_SIZE = 200;

export type ImportState = {
  error?: string;
  success?: boolean;
  imported?: number;
  failed?: number;
  total?: number;
};

export async function importSitesCsv(
  workspaceSlug: string,
  _prev: ActionState,
  formData: FormData
): Promise<ImportState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "認証されていません。ログインしてください。" };

  const file = formData.get("file") as File | null;
  const orgId = formData.get("organizationId") as string | null;
  if (!file) return { error: "ファイルが選択されていません" };
  if (!orgId) return { error: "組織の選択は必須です" };
  if (file.size > 10 * 1024 * 1024) return { error: "ファイルサイズが大きすぎます（上限 10 MB）" };

  const text = await file.text();
  const { headers, rows } = parseCsv(text);

  if (rows.length === 0) return { error: "CSVにデータ行がありません" };

  const missing = validateHeaders(headers, ["name", "site_type"]);
  if (missing.length > 0)
    return { error: `必須カラムが不足しています: ${missing.join(", ")}` };

  const admin = createAdminClient();
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .is("deleted_at", null)
    .single();
  if (!ws) return { error: "ワークスペースが見つかりません" };

  let imported = 0;
  let failed = 0;
  const errors: string[] = [];
  const chunks = chunk(rows, BATCH_SIZE);

  for (let ci = 0; ci < chunks.length; ci++) {
    const batch = chunks[ci];
    const batchOffset = ci * BATCH_SIZE + 2;

    // 1. Build site payloads
    const sitePayloads = batch.map((row) => ({
      name: row.name || "Unnamed",
      site_type: row.site_type || "other",
      country_code: row.country_code || null,
      region_admin1: row.region_admin1 || null,
      lat: row.lat ? parseFloat(row.lat) : null,
      lng: row.lng ? parseFloat(row.lng) : null,
      area_ha: row.area_ha ? parseFloat(row.area_ha) : null,
      address: row.address || null,
    }));

    // 2. Batch insert sites
    const { data: insertedSites, error: siteErr } = await admin
      .from("sites")
      .insert(sitePayloads)
      .select("id");

    if (siteErr || !insertedSites) {
      // Fallback to row-by-row
      const rowResults = await insertSiteRowByRow(admin, batch, orgId, ws.id, batchOffset);
      imported += rowResults.imported;
      failed += rowResults.failed;
      errors.push(...rowResults.errors);
      continue;
    }

    // 3. Batch insert organization_sites links
    const orgSitePayloads = insertedSites.map((site) => ({
      organization_id: orgId,
      site_id: site.id,
      role: "operator" as const,
    }));

    const { error: orgLinkErr } = await admin
      .from("organization_sites")
      .insert(orgSitePayloads);

    if (orgLinkErr) {
      errors.push(`チャンク ${ci + 1}: org_site リンクエラー — ${orgLinkErr.message}`);
    }

    // 4. Batch insert workspace_sites links
    const wsSitePayloads = insertedSites.map((site) => ({
      workspace_id: ws.id,
      site_id: site.id,
      visibility: "full" as const,
    }));

    const { error: wsLinkErr } = await admin
      .from("workspace_sites")
      .insert(wsSitePayloads);

    if (wsLinkErr) {
      errors.push(`チャンク ${ci + 1}: ws_site リンクエラー — ${wsLinkErr.message}`);
    }

    imported += insertedSites.length;
  }

  revalidatePath(`/app/${workspaceSlug}/sites`);

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

/** Fallback: insert rows one-by-one when a batch insert fails */
async function insertSiteRowByRow(
  admin: ReturnType<typeof createAdminClient>,
  rows: CsvRow[],
  orgId: string,
  workspaceId: string,
  startRowNum: number
) {
  let imported = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = startRowNum + i;

    const { data: site, error: siteErr } = await admin
      .from("sites")
      .insert({
        name: row.name || "Unnamed",
        site_type: row.site_type || "other",
        country_code: row.country_code || null,
        region_admin1: row.region_admin1 || null,
        lat: row.lat ? parseFloat(row.lat) : null,
        lng: row.lng ? parseFloat(row.lng) : null,
        area_ha: row.area_ha ? parseFloat(row.area_ha) : null,
        address: row.address || null,
      })
      .select("id")
      .single();

    if (siteErr || !site) {
      errors.push(`行 ${rowNum}: ${siteErr?.message ?? "失敗"}`);
      failed++;
      continue;
    }

    await admin.from("organization_sites").insert({
      organization_id: orgId,
      site_id: site.id,
      role: "operator",
    });

    await admin.from("workspace_sites").insert({
      workspace_id: workspaceId,
      site_id: site.id,
      visibility: "full",
    });

    imported++;
  }

  return { imported, failed, errors };
}
