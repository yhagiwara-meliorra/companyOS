"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/supabase-server";
import { createAdminClient } from "@/lib/db/admin";
import { appendChangeLog } from "@/lib/domain/change-log";
import { z } from "zod/v4";

// ── Schemas ─────────────────────────────────────────────────
const SiteSchema = z.object({
  name: z.string().min(1, "サイト名は必須です"),
  siteType: z.enum([
    "farm",
    "factory",
    "warehouse",
    "port",
    "mine",
    "office",
    "project_site",
    "store",
    "unknown",
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
      site_name: name,
      site_type: siteType,
      country_code: countryCode || null,
      region: regionAdmin1 || null,
      latitude: lat ?? null,
      longitude: lng ?? null,
      area_ha: areaHa ?? null,
      address_text: address || null,
      verification_status: "declared",
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
      ownership_role: "operator",
    });

  if (orgSiteErr) return { error: orgSiteErr.message };

  // Link site to workspace
  const { error: wsSiteErr } = await admin
    .from("workspace_sites")
    .insert({
      workspace_id: ws.id,
      site_id: site.id,
      scope_role: "own_operation",
      verification_status: "declared",
    });

  if (wsSiteErr) return { error: wsSiteErr.message };

  await appendChangeLog(ws.id, user.id, "sites", site.id, "insert", null, {
    name,
    site_type: siteType,
    country_code: countryCode,
  });

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
      site_name: parsed.data.name,
      site_type: parsed.data.siteType,
      country_code: parsed.data.countryCode || null,
      region: parsed.data.regionAdmin1 || null,
      latitude: parsed.data.lat ?? null,
      longitude: parsed.data.lng ?? null,
      area_ha: parsed.data.areaHa ?? null,
      address_text: parsed.data.address || null,
    })
    .eq("id", siteId);

  if (error) return { error: error.message };

  const adminForWs = createAdminClient();
  const { data: wsForLog } = await adminForWs
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .is("deleted_at", null)
    .single();
  if (wsForLog) {
    await appendChangeLog(wsForLog.id, user.id, "sites", siteId, "update", null, {
      name: parsed.data.name,
      site_type: parsed.data.siteType,
    });
  }

  revalidatePath(`/app/${workspaceSlug}/sites`);
  return { success: true };
}

// ── CSV Import Sites (batch) ────────────────────────────────
// Handles up to ~2000 rows via chunked batch inserts.
// Each chunk: 1 bulk INSERT sites → 1 bulk INSERT org_sites → 1 bulk INSERT ws_sites
// ≈ 15 queries for 1000 rows (vs 3000+ row-by-row).

import { parseCsv, validateHeaders, chunk, type CsvRow } from "@/lib/csv";

const BATCH_SIZE = 200;
const VALID_SITE_TYPES = new Set([
  "office", "factory", "warehouse", "farm", "mine",
  "port", "project_site", "store", "unknown",
]);

export type ImportState = {
  error?: string;
  success?: boolean;
  imported?: number;
  failed?: number;
  total?: number;
};

export async function importSitesCsv(
  workspaceSlug: string,
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  try {
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

    const missing = validateHeaders(headers, ["site_name", "site_type"]);
    if (missing.length > 0)
      return { error: `必須カラムが不足しています: ${missing.join(", ")}` };

    // Pre-validate site_type values against DB CHECK constraint
    const invalidRows: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const siteType = (rows[i].site_type || "").trim().toLowerCase();
      if (siteType && !VALID_SITE_TYPES.has(siteType)) {
        invalidRows.push(`行${i + 2}: site_type="${rows[i].site_type}"は無効です（有効値: ${[...VALID_SITE_TYPES].join(", ")}）`);
      }
      // Validate numeric fields
      if (rows[i].latitude && isNaN(parseFloat(rows[i].latitude))) {
        invalidRows.push(`行${i + 2}: latitude="${rows[i].latitude}"は数値ではありません`);
      }
      if (rows[i].longitude && isNaN(parseFloat(rows[i].longitude))) {
        invalidRows.push(`行${i + 2}: longitude="${rows[i].longitude}"は数値ではありません`);
      }
      if (rows[i].area_ha && isNaN(parseFloat(rows[i].area_ha))) {
        invalidRows.push(`行${i + 2}: area_ha="${rows[i].area_ha}"は数値ではありません`);
      }
    }
    if (invalidRows.length > 0) {
      return { error: invalidRows.slice(0, 5).join("\n") };
    }

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
        site_name: row.site_name || "Unnamed",
        site_type: row.site_type?.trim().toLowerCase() || "unknown",
        country_code: row.country_code?.trim() || null,
        region: row.region?.trim() || null,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        area_ha: row.area_ha ? parseFloat(row.area_ha) : null,
        address_text: row.address_text?.trim() || null,
        verification_status: "inferred" as const,
      }));

      // 2. Batch insert sites
      const { data: insertedSites, error: siteErr } = await admin
        .from("sites")
        .insert(sitePayloads)
        .select("id");

      if (siteErr || !insertedSites) {
        // Fallback to row-by-row
        console.error(`[Site CSV Import] Batch ${ci + 1} failed:`, siteErr?.message);
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
        ownership_role: "operator" as const,
      }));

      const { error: orgLinkErr } = await admin
        .from("organization_sites")
        .insert(orgSitePayloads);

      if (orgLinkErr) {
        console.error(`[Site CSV Import] org_site link batch ${ci + 1} failed:`, orgLinkErr.message);
        errors.push(`org_site リンクエラー: ${orgLinkErr.message}`);
      }

      // 4. Batch insert workspace_sites links
      const wsSitePayloads = insertedSites.map((site) => ({
        workspace_id: ws.id,
        site_id: site.id,
        scope_role: "own_operation" as const,
        verification_status: "inferred" as const,
      }));

      const { error: wsLinkErr } = await admin
        .from("workspace_sites")
        .insert(wsSitePayloads);

      if (wsLinkErr) {
        console.error(`[Site CSV Import] ws_site link batch ${ci + 1} failed:`, wsLinkErr.message);
        errors.push(`ws_site リンクエラー: ${wsLinkErr.message}`);
      }

      imported += insertedSites.length;
    }

    if (imported > 0) {
      await appendChangeLog(ws.id, user.id, "sites", ws.id, "insert", null, {
        action: "csv_import",
        imported,
        failed,
        total: rows.length,
      });
    }

    revalidatePath(`/app/${workspaceSlug}/sites`);

    if (errors.length > 0) {
      return {
        error: `${imported}/${rows.length}件インポート。エラー: ${errors.slice(0, 3).join("; ")}`,
        imported,
        failed,
        total: rows.length,
      };
    }
    return { success: true, imported, total: rows.length };
  } catch (e) {
    console.error("[Site CSV Import] Unexpected error:", e);
    return { error: `サーバーエラー: ${e instanceof Error ? e.message : String(e)}` };
  }
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
    const siteType = row.site_type?.trim().toLowerCase() || "unknown";

    if (!VALID_SITE_TYPES.has(siteType)) {
      errors.push(`行${rowNum}: site_type="${row.site_type}"は無効`);
      failed++;
      continue;
    }

    const { data: site, error: siteErr } = await admin
      .from("sites")
      .insert({
        site_name: row.site_name || "Unnamed",
        site_type: siteType,
        country_code: row.country_code?.trim() || null,
        region: row.region?.trim() || null,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        area_ha: row.area_ha ? parseFloat(row.area_ha) : null,
        address_text: row.address_text?.trim() || null,
        verification_status: "inferred" as const,
      })
      .select("id")
      .single();

    if (siteErr || !site) {
      errors.push(`行${rowNum}: ${siteErr?.message ?? "作成失敗"}`);
      failed++;
      continue;
    }

    const { error: orgLinkErr } = await admin.from("organization_sites").insert({
      organization_id: orgId,
      site_id: site.id,
      ownership_role: "operator",
    });

    if (orgLinkErr) {
      errors.push(`行${rowNum}: org_site リンク失敗 — ${orgLinkErr.message}`);
    }

    const { error: wsLinkErr } = await admin.from("workspace_sites").insert({
      workspace_id: workspaceId,
      site_id: site.id,
      scope_role: "own_operation",
      verification_status: "inferred",
    });

    if (wsLinkErr) {
      errors.push(`行${rowNum}: ws_site リンク失敗 — ${wsLinkErr.message}`);
    }

    imported++;
  }

  return { imported, failed, errors };
}
