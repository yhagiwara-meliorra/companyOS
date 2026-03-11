"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/supabase-server";
import { createAdminClient } from "@/lib/db/admin";

export type ActionState = { error?: string; success?: boolean };

// ── Helpers ─────────────────────────────────────────────────

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function resolveWorkspace(admin: ReturnType<typeof createAdminClient>, slug: string) {
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single();
  return ws;
}

// ── Change Log ──────────────────────────────────────────────
// Append-only audit logger. Called internally by other actions.

export async function appendChangeLog(
  workspaceId: string,
  userId: string,
  targetTable: string,
  targetId: string,
  action: string,
  beforeState?: Record<string, unknown> | null,
  afterState?: Record<string, unknown> | null
) {
  const admin = createAdminClient();
  await admin.from("change_log").insert({
    workspace_id: workspaceId,
    actor_user_id: userId,
    target_table: targetTable,
    target_id: targetId,
    action,
    before_state: beforeState ?? null,
    after_state: afterState ?? null,
  });
}

// ── Upload Evidence ─────────────────────────────────────────
// Accepts FormData with a file + metadata. Uploads to Supabase Storage
// and creates the evidence_items record.

export async function uploadEvidence(
  workspaceSlug: string,
  formData: FormData
): Promise<ActionState & { evidenceId?: string }> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (!ws) return { error: "Workspace not found" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file selected" };

  // Validate file size (50MB)
  if (file.size > 50 * 1024 * 1024) {
    return { error: "File size exceeds 50MB limit" };
  }

  const evidenceType = (formData.get("evidenceType") as string) || "other";
  const visibility =
    (formData.get("visibility") as string) || "workspace_private";
  const organizationId = (formData.get("organizationId") as string) || null;
  const siteId = (formData.get("siteId") as string) || null;

  // Generate storage path: {workspace_id}/{timestamp}_{filename}
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${ws.id}/${timestamp}_${safeName}`;

  // Upload to Supabase Storage via admin client (bypasses storage RLS)
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = new Uint8Array(arrayBuffer);

  const { error: uploadErr } = await admin.storage
    .from("evidence")
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadErr) {
    return { error: `Upload failed: ${uploadErr.message}` };
  }

  // Create evidence_items record
  const { data: evidence, error: insertErr } = await admin
    .from("evidence_items")
    .insert({
      workspace_id: ws.id,
      organization_id: organizationId || null,
      site_id: siteId || null,
      storage_bucket: "evidence",
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      evidence_type: evidenceType,
      visibility,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (insertErr) {
    // Try to clean up the uploaded file
    await admin.storage.from("evidence").remove([storagePath]);
    return { error: insertErr.message };
  }

  // Audit log
  await appendChangeLog(ws.id, user.id, "evidence_items", evidence.id, "insert", null, {
    file_name: file.name,
    evidence_type: evidenceType,
    visibility,
  });

  revalidatePath(`/app/${workspaceSlug}/evidence`);
  return { success: true, evidenceId: evidence.id };
}

// ── Link Evidence ───────────────────────────────────────────

export async function linkEvidence(
  workspaceSlug: string,
  evidenceItemId: string,
  targetType: string,
  targetId: string,
  note?: string
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (!ws) return { error: "Workspace not found" };

  const { error } = await admin.from("evidence_links").insert({
    evidence_item_id: evidenceItemId,
    target_type: targetType,
    target_id: targetId,
    note: note || null,
  });

  if (error) return { error: error.message };

  // Audit log
  await appendChangeLog(ws.id, user.id, "evidence_links", evidenceItemId, "insert", null, {
    target_type: targetType,
    target_id: targetId,
  });

  revalidatePath(`/app/${workspaceSlug}/evidence`);
  return { success: true };
}

// ── Update Visibility ───────────────────────────────────────

export async function updateEvidenceVisibility(
  workspaceSlug: string,
  evidenceId: string,
  visibility: string
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (!ws) return { error: "Workspace not found" };

  // Get current state
  const { data: current } = await admin
    .from("evidence_items")
    .select("visibility")
    .eq("id", evidenceId)
    .single();

  const { error } = await admin
    .from("evidence_items")
    .update({ visibility })
    .eq("id", evidenceId);

  if (error) return { error: error.message };

  // Audit log
  const action = visibility === "shared_to_buyers" ? "share" : "status_change";
  await appendChangeLog(ws.id, user.id, "evidence_items", evidenceId, action, {
    visibility: current?.visibility,
  }, {
    visibility,
  });

  revalidatePath(`/app/${workspaceSlug}/evidence`);
  return { success: true };
}

// ── Soft Delete Evidence ────────────────────────────────────

export async function deleteEvidence(
  workspaceSlug: string,
  evidenceId: string
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (!ws) return { error: "Workspace not found" };

  // Soft delete (set deleted_at)
  const { error } = await admin
    .from("evidence_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", evidenceId);

  if (error) return { error: error.message };

  // Audit log
  await appendChangeLog(ws.id, user.id, "evidence_items", evidenceId, "delete");

  revalidatePath(`/app/${workspaceSlug}/evidence`);
  return { success: true };
}

// ── Get Signed URL ──────────────────────────────────────────

export async function getEvidenceUrl(
  storagePath: string
): Promise<{ url?: string; error?: string }> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("evidence")
    .createSignedUrl(storagePath, 3600); // 1 hour expiry

  if (error) return { error: error.message };
  return { url: data.signedUrl };
}
