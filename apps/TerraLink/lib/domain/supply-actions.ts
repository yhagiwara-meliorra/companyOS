"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/supabase-server";
import { createAdminClient } from "@/lib/db/admin";
import { appendChangeLog } from "@/lib/domain/change-log";
import { z } from "zod/v4";

export type ActionState = { error?: string; success?: boolean };

// ── Schemas ─────────────────────────────────────────────────
const SupplyRelationshipSchema = z.object({
  fromWsOrgId: z.string().uuid("Invalid from organization"),
  toWsOrgId: z.string().uuid("Invalid to organization"),
  tier: z.coerce.number().int().min(0).max(10).optional(),
  relationshipType: z
    .enum(["supplies", "manufactures_for", "ships_for", "sells_to", "owns"])
    .default("supplies"),
  verificationStatus: z
    .enum(["inferred", "declared", "verified"])
    .default("inferred"),
});

const SupplyEdgeSchema = z.object({
  relationshipId: z.string().uuid(),
  fromSiteId: z.string().uuid("Source site is required"),
  toSiteId: z.string().uuid("Destination site is required"),
  flowDirection: z
    .enum(["upstream", "downstream"])
    .default("upstream"),
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
    fromWsOrgId: formData.get("fromWsOrgId"),
    toWsOrgId: formData.get("toWsOrgId"),
    tier: formData.get("tier") || undefined,
    relationshipType: formData.get("relationshipType") || "direct_supplier",
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
    from_workspace_org_id: parsed.data.fromWsOrgId,
    to_workspace_org_id: parsed.data.toWsOrgId,
    tier: parsed.data.tier ?? null,
    relationship_type: parsed.data.relationshipType,
    verification_status: parsed.data.verificationStatus,
    confidence_score: 0,
    source_type: "manual",
  });

  if (error) return { error: error.message };

  await appendChangeLog(ws.id, user.id, "supply_relationships", ws.id, "insert", null, {
    from_workspace_org_id: parsed.data.fromWsOrgId,
    to_workspace_org_id: parsed.data.toWsOrgId,
    relationship_type: parsed.data.relationshipType,
    tier: parsed.data.tier,
  });

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
  const verificationStatus = formData.get("verificationStatus") as string | null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("supply_relationships")
    .update({
      tier: tier ? parseInt(tier as string, 10) : null,
      verification_status: verificationStatus || "inferred",
    })
    .eq("id", relationshipId);

  if (error) return { error: error.message };

  const { data: wsForLog } = await createAdminClient()
    .from("workspaces").select("id").eq("slug", workspaceSlug).is("deleted_at", null).single();
  if (wsForLog) {
    await appendChangeLog(wsForLog.id, user.id, "supply_relationships", relationshipId, "update", null, {
      tier: tier ? parseInt(tier as string, 10) : null,
      verification_status: verificationStatus,
    });
  }

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
    flowDirection: formData.get("flowDirection") || "unknown",
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

  const { error } = await admin.from("supply_edges").insert({
    workspace_id: ws.id,
    relationship_id: parsed.data.relationshipId,
    from_site_id: parsed.data.fromSiteId,
    to_site_id: parsed.data.toSiteId,
    flow_direction: parsed.data.flowDirection,
    verification_status: parsed.data.verificationStatus,
  });

  if (error) return { error: error.message };

  await appendChangeLog(ws.id, user.id, "supply_edges", ws.id, "insert", null, {
    from_site_id: parsed.data.fromSiteId,
    to_site_id: parsed.data.toSiteId,
    flow_direction: parsed.data.flowDirection,
  });

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
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", relationshipId);

  if (error) return { error: error.message };

  const { data: wsForLog } = await createAdminClient()
    .from("workspaces").select("id").eq("slug", workspaceSlug).is("deleted_at", null).single();
  if (wsForLog) {
    await appendChangeLog(wsForLog.id, user.id, "supply_relationships", relationshipId, "soft_delete", null, {
      deleted_at: new Date().toISOString(),
    });
  }

  revalidatePath(`/app/${workspaceSlug}/supply`);
  return { success: true };
}
