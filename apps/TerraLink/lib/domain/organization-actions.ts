"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/supabase-server";
import { createAdminClient } from "@/lib/db/admin";
import { appendChangeLog } from "@/lib/domain/change-log";
import { z } from "zod/v4";

// ── Schemas ─────────────────────────────────────────────────
const OrgSchema = z.object({
  legalName: z.string().min(1, "法人名は必須です"),
  displayName: z.string().min(1, "表示名は必須です"),
  orgType: z.enum([
    "buyer",
    "supplier",
    "customer",
    "partner",
    "logistics",
    "internal",
  ]),
  countryCode: z.string().max(3).optional(),
  website: z.string().url().optional().or(z.literal("")),
});

const LinkOrgSchema = z.object({
  organizationId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  relationshipRole: z.enum([
    "buyer",
    "supplier",
    "customer",
    "partner",
    "site_owner",
  ]),
  tier: z.coerce.number().int().min(0).max(10).optional(),
  verificationStatus: z.enum(["inferred", "declared", "verified"]).default("inferred"),
});

export type ActionState = { error?: string; success?: boolean };

// ── Create Organization ─────────────────────────────────────
export async function createOrganization(
  workspaceSlug: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "認証されていません。ログインしてください。" };

  const parsed = OrgSchema.safeParse({
    legalName: formData.get("legalName"),
    displayName: formData.get("displayName"),
    orgType: formData.get("orgType"),
    countryCode: formData.get("countryCode") || undefined,
    website: formData.get("website") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { legalName, displayName, orgType, countryCode, website } = parsed.data;

  const admin = createAdminClient();

  // Get workspace
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .is("deleted_at", null)
    .single();
  if (!ws) return { error: "ワークスペースが見つかりません" };

  // Create organization (service_role — canonical master)
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({
      legal_name: legalName,
      display_name: displayName,
      org_type: orgType,
      country_code: countryCode || null,
      website: website || null,
    })
    .select("id")
    .single();

  if (orgErr || !org) return { error: orgErr?.message ?? "組織の作成に失敗しました" };

  // Link to workspace
  const role = orgType === "buyer" ? "buyer" : "supplier";
  const { error: linkErr } = await admin
    .from("workspace_organizations")
    .insert({
      workspace_id: ws.id,
      organization_id: org.id,
      relationship_role: role,
      status: "active",
      verification_status: "declared",
    });

  if (linkErr) return { error: linkErr.message };

  await appendChangeLog(ws.id, user.id, "organizations", org.id, "insert", null, {
    legal_name: legalName,
    display_name: displayName,
    org_type: orgType,
  });

  revalidatePath(`/app/${workspaceSlug}/orgs`);
  return { success: true };
}

// ── Update Organization ─────────────────────────────────────
export async function updateOrganization(
  workspaceSlug: string,
  orgId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "認証されていません。ログインしてください。" };

  const parsed = OrgSchema.safeParse({
    legalName: formData.get("legalName"),
    displayName: formData.get("displayName"),
    orgType: formData.get("orgType"),
    countryCode: formData.get("countryCode") || undefined,
    website: formData.get("website") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({
      legal_name: parsed.data.legalName,
      display_name: parsed.data.displayName,
      org_type: parsed.data.orgType,
      country_code: parsed.data.countryCode || null,
      website: parsed.data.website || null,
    })
    .eq("id", orgId);

  if (error) return { error: error.message };

  const adminForWs = createAdminClient();
  const { data: wsForLog } = await adminForWs
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .is("deleted_at", null)
    .single();
  if (wsForLog) {
    await appendChangeLog(wsForLog.id, user.id, "organizations", orgId, "update", null, {
      legal_name: parsed.data.legalName,
      display_name: parsed.data.displayName,
      org_type: parsed.data.orgType,
    });
  }

  revalidatePath(`/app/${workspaceSlug}/orgs`);
  return { success: true };
}

// ── Update workspace_organizations link ─────────────────────
export async function updateOrgLink(
  workspaceSlug: string,
  linkId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "認証されていません。ログインしてください。" };

  const parsed = LinkOrgSchema.safeParse({
    organizationId: formData.get("organizationId"),
    workspaceId: formData.get("workspaceId"),
    relationshipRole: formData.get("relationshipRole"),
    tier: formData.get("tier") || undefined,
    verificationStatus: formData.get("verificationStatus"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { error } = await admin
    .from("workspace_organizations")
    .update({
      relationship_role: parsed.data.relationshipRole,
      tier: parsed.data.tier ?? null,
      verification_status: parsed.data.verificationStatus,
    })
    .eq("id", linkId);

  if (error) return { error: error.message };

  await appendChangeLog(parsed.data.workspaceId, user.id, "workspace_organizations", linkId, "update", null, {
    relationship_role: parsed.data.relationshipRole,
    tier: parsed.data.tier,
    verification_status: parsed.data.verificationStatus,
  });

  revalidatePath(`/app/${workspaceSlug}/orgs`);
  return { success: true };
}

// ── CSV Import Organizations (batch) ────────────────────────
// Handles up to ~2000 rows via chunked batch inserts.
// Each chunk: 1 bulk INSERT orgs → 1 bulk INSERT workspace_organizations
// ≈ 10 queries for 1000 rows (vs 2000+ in the row-by-row approach).

import { parseCsv, validateHeaders, chunk, type CsvRow } from "@/lib/csv";

const BATCH_SIZE = 200;
const VALID_ORG_TYPES = new Set([
  "buyer", "supplier", "customer", "partner", "logistics", "internal",
]);

export type ImportState = {
  error?: string;
  success?: boolean;
  imported?: number;
  failed?: number;
  total?: number;
};

export async function importOrganizationsCsv(
  workspaceSlug: string,
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "認証されていません。ログインしてください。" };

    const file = formData.get("file") as File | null;
    if (!file) return { error: "ファイルが選択されていません" };
    if (file.size > 10 * 1024 * 1024) return { error: "ファイルサイズが大きすぎます（上限 10 MB）" };

    const text = await file.text();
    const { headers, rows } = parseCsv(text);

    if (rows.length === 0) return { error: "CSVにデータ行がありません" };

    const missing = validateHeaders(headers, ["legal_name", "display_name", "org_type"]);
    if (missing.length > 0)
      return { error: `必須カラムが不足しています: ${missing.join(", ")}` };

    // Pre-validate org_type values against DB CHECK constraint
    const invalidRows: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const orgType = (rows[i].org_type || "").trim().toLowerCase();
      if (orgType && !VALID_ORG_TYPES.has(orgType)) {
        invalidRows.push(`行${i + 2}: org_type="${rows[i].org_type}"は無効です（有効値: ${[...VALID_ORG_TYPES].join(", ")}）`);
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
      const batchOffset = ci * BATCH_SIZE + 2; // +2 = header row + 1-indexed

      // 1. Validate & build insert payloads
      const orgPayloads = batch.map((row) => ({
        legal_name: row.legal_name || "Unnamed",
        display_name: row.display_name || row.legal_name || "Unnamed",
        org_type: row.org_type?.trim().toLowerCase() || "supplier",
        country_code: row.country_code?.trim() || null,
        website: row.website?.trim() || null,
      }));

      // 2. Batch insert organizations
      const { data: insertedOrgs, error: orgErr } = await admin
        .from("organizations")
        .insert(orgPayloads)
        .select("id");

      if (orgErr || !insertedOrgs) {
        // If the whole batch fails, try row-by-row fallback for this chunk
        console.error(`[CSV Import] Batch ${ci + 1} failed:`, orgErr?.message);
        const rowResults = await insertOrgRowByRow(admin, batch, ws.id, batchOffset);
        imported += rowResults.imported;
        failed += rowResults.failed;
        errors.push(...rowResults.errors);
        continue;
      }

      // 3. Batch insert workspace_organizations links
      const linkPayloads = insertedOrgs.map((org, idx) => ({
        workspace_id: ws.id,
        organization_id: org.id,
        relationship_role: batch[idx].org_type?.trim().toLowerCase() === "buyer" ? "buyer" as const : "supplier" as const,
        status: "active" as const,
        verification_status: "declared" as const,
      }));

      const { error: linkErr } = await admin
        .from("workspace_organizations")
        .insert(linkPayloads);

      if (linkErr) {
        console.error(`[CSV Import] Link batch ${ci + 1} failed:`, linkErr.message);
        errors.push(`リンクエラー: ${linkErr.message}`);
        // Orgs were created but links failed; count as partial success
        imported += insertedOrgs.length;
        failed += 0;
      } else {
        imported += insertedOrgs.length;
      }
    }

    if (imported > 0) {
      await appendChangeLog(ws.id, user.id, "organizations", ws.id, "insert", null, {
        action: "csv_import",
        imported,
        failed,
        total: rows.length,
      });
    }

    revalidatePath(`/app/${workspaceSlug}/orgs`);

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
    console.error("[CSV Import] Unexpected error:", e);
    return { error: `サーバーエラー: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Fallback: insert rows one-by-one when a batch insert fails */
async function insertOrgRowByRow(
  admin: ReturnType<typeof createAdminClient>,
  rows: CsvRow[],
  workspaceId: string,
  startRowNum: number
) {
  let imported = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = startRowNum + i;
    const orgType = row.org_type?.trim().toLowerCase() || "supplier";

    if (!VALID_ORG_TYPES.has(orgType)) {
      errors.push(`行${rowNum}: org_type="${row.org_type}"は無効`);
      failed++;
      continue;
    }

    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({
        legal_name: row.legal_name || "Unnamed",
        display_name: row.display_name || row.legal_name || "Unnamed",
        org_type: orgType,
        country_code: row.country_code?.trim() || null,
        website: row.website?.trim() || null,
      })
      .select("id")
      .single();

    if (orgErr || !org) {
      errors.push(`行${rowNum}: ${orgErr?.message ?? "作成失敗"}`);
      failed++;
      continue;
    }

    const { error: linkErr } = await admin.from("workspace_organizations").insert({
      workspace_id: workspaceId,
      organization_id: org.id,
      relationship_role: orgType === "buyer" ? "buyer" : "supplier",
      status: "active",
      verification_status: "declared",
    });

    if (linkErr) {
      errors.push(`行${rowNum}: リンク失敗 — ${linkErr.message}`);
      // org was created, count as partial
    }

    imported++;
  }

  return { imported, failed, errors };
}
