"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/supabase-server";
import { createAdminClient } from "@/lib/db/admin";
import { z } from "zod/v4";

export type ActionState = { error?: string; success?: boolean };

// ── Schemas ─────────────────────────────────────────────────

const SupplierProfileSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
  legalName: z.string().min(1, "Legal name is required"),
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

const SupplierSiteSchema = z.object({
  siteName: z.string().min(1, "Site name is required"),
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

// ── Helpers ─────────────────────────────────────────────────

async function requireSupplierAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("organization_members")
    .select("id, organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) return null;
  return { userId: user.id, orgId: membership.organization_id, role: membership.role };
}

// ── Update Supplier Profile ─────────────────────────────────

export async function updateSupplierProfile(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await requireSupplierAuth();
  if (!auth) return { error: "認証されていません" };

  const parsed = SupplierProfileSchema.safeParse({
    displayName: formData.get("displayName"),
    legalName: formData.get("legalName"),
    orgType: formData.get("orgType"),
    countryCode: formData.get("countryCode") || undefined,
    website: formData.get("website") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();

  const { error } = await admin
    .from("organizations")
    .update({
      display_name: parsed.data.displayName,
      legal_name: parsed.data.legalName,
      org_type: parsed.data.orgType,
      country_code: parsed.data.countryCode || null,
      website: parsed.data.website || null,
    })
    .eq("id", auth.orgId);

  if (error) return { error: error.message };

  revalidatePath("/supplier");
  return { success: true };
}

// ── Add Supplier Site ───────────────────────────────────────

export async function addSupplierSite(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await requireSupplierAuth();
  if (!auth) return { error: "認証されていません" };

  const parsed = SupplierSiteSchema.safeParse({
    siteName: formData.get("siteName"),
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

  // 1. Create the site
  const { data: site, error: siteErr } = await admin
    .from("sites")
    .insert({
      site_name: parsed.data.siteName,
      site_type: parsed.data.siteType,
      country_code: parsed.data.countryCode || null,
      region: parsed.data.regionAdmin1 || null,
      latitude: parsed.data.lat ?? null,
      longitude: parsed.data.lng ?? null,
      address_text: parsed.data.address || null,
      verification_status: "declared",
    })
    .select("id")
    .single();

  if (siteErr || !site) return { error: siteErr?.message ?? "Failed to create site" };

  // 2. Link site to organization
  const { error: linkErr } = await admin.from("organization_sites").insert({
    organization_id: auth.orgId,
    site_id: site.id,
    ownership_role: "operator",
    is_primary: false,
  });

  if (linkErr) return { error: linkErr.message };

  // 3. Auto-link to workspaces that have this org
  const { data: wsOrgs } = await admin
    .from("workspace_organizations")
    .select("id, workspace_id")
    .eq("organization_id", auth.orgId)
    .eq("status", "active");

  if (wsOrgs && wsOrgs.length > 0) {
    for (const wo of wsOrgs) {
      await admin.from("workspace_sites").insert({
        workspace_id: wo.workspace_id,
        site_id: site.id,
        workspace_organization_id: wo.id,
        scope_role: "upstream",
        verification_status: "declared",
      });
    }
  }

  revalidatePath("/supplier");
  return { success: true };
}

// ── Update Verification Status ──────────────────────────────

export async function declareVerificationStatus(
  siteId: string,
  status: string
): Promise<ActionState> {
  const auth = await requireSupplierAuth();
  if (!auth) return { error: "認証されていません" };

  // Verify the site belongs to this org
  const admin = createAdminClient();
  const { data: orgSite } = await admin
    .from("organization_sites")
    .select("id")
    .eq("organization_id", auth.orgId)
    .eq("site_id", siteId)
    .single();

  if (!orgSite) return { error: "このサイトにアクセスする権限がありません" };

  // Suppliers can only set to "declared" — only buyers can set "verified"
  const validStatus = status === "declared" ? "declared" : "declared";

  const { error } = await admin
    .from("sites")
    .update({ verification_status: validStatus })
    .eq("id", siteId);

  if (error) return { error: error.message };

  revalidatePath("/supplier");
  return { success: true };
}
