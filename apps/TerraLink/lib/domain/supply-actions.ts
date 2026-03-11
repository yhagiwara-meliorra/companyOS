"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/supabase-server";
import { createAdminClient } from "@/lib/db/admin";
import { z } from "zod/v4";

export type ActionState = { error?: string; success?: boolean };

// ── Schemas ─────────────────────────────────────────────────
const SupplyRelationshipSchema = z.object({
  buyerOrgId: z.string().uuid("Invalid buyer organization"),
  supplierOrgId: z.string().uuid("Invalid supplier organization"),
  tier: z.coerce.number().int().min(0).max(10).optional(),
  status: z.enum(["active", "inactive", "pending"]).default("active"),
  verificationStatus: z
    .enum(["inferred", "declared", "verified"])
    .default("inferred"),
});

const SupplyEdgeSchema = z.object({
  relationshipId: z.string().uuid(),
  fromSiteId: z.string().uuid("Source site is required"),
  toSiteId: z.string().uuid("Destination site is required"),
  transportMode: z
    .enum(["road", "rail", "sea", "air", "pipeline", "unknown"])
    .default("unknown"),
  verificationStatus: z
    .enum(["inferred", "declared", "verified"])
    .default("inferred"),
});

// ── Create Supply Relationship ──────────────────────────────
export async function createSupplyRelationship(
  workspaceSlug: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = SupplyRelationshipSchema.safeParse({
    buyerOrgId: formData.get("buyerOrgId"),
    supplierOrgId: formData.get("supplierOrgId"),
    tier: formData.get("tier") || undefined,
    status: formData.get("status") || "active",
    verificationStatus: formData.get("verificationStatus") || "inferred",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();

  // Get workspace
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .is("deleted_at", null)
    .single();
  if (!ws) return { error: "Workspace not found" };

  const { error } = await admin.from("supply_relationships").insert({
    workspace_id: ws.id,
    buyer_org_id: parsed.data.buyerOrgId,
    supplier_org_id: parsed.data.supplierOrgId,
    tier: parsed.data.tier ?? null,
    status: parsed.data.status,
    verification_status: parsed.data.verificationStatus,
  });

  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/supply`);
  return { success: true };
}

// ── Update Supply Relationship ──────────────────────────────
export async function updateSupplyRelationship(
  workspaceSlug: string,
  relationshipId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tier = formData.get("tier");
  const status = formData.get("status") as string | null;
  const verificationStatus = formData.get("verificationStatus") as string | null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("supply_relationships")
    .update({
      tier: tier ? parseInt(tier as string, 10) : null,
      status: status || "active",
      verification_status: verificationStatus || "inferred",
    })
    .eq("id", relationshipId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/supply`);
  return { success: true };
}

// ── Create Supply Edge ──────────────────────────────────────
export async function createSupplyEdge(
  workspaceSlug: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = SupplyEdgeSchema.safeParse({
    relationshipId: formData.get("relationshipId"),
    fromSiteId: formData.get("fromSiteId"),
    toSiteId: formData.get("toSiteId"),
    transportMode: formData.get("transportMode") || "unknown",
    verificationStatus: formData.get("verificationStatus") || "inferred",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { error } = await admin.from("supply_edges").insert({
    relationship_id: parsed.data.relationshipId,
    from_site_id: parsed.data.fromSiteId,
    to_site_id: parsed.data.toSiteId,
    transport_mode: parsed.data.transportMode,
    verification_status: parsed.data.verificationStatus,
  });

  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/supply`);
  return { success: true };
}

// ── Delete Supply Relationship ──────────────────────────────
export async function deleteSupplyRelationship(
  workspaceSlug: string,
  relationshipId: string
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("supply_relationships")
    .update({ status: "inactive" })
    .eq("id", relationshipId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/supply`);
  return { success: true };
}
