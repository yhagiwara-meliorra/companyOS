"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/supabase-server";
import { createAdminClient } from "@/lib/db/admin";
import { appendChangeLog } from "@/lib/domain/change-log";

export type ActionState = { error?: string; success?: boolean };

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

// ── Create Monitoring Rule ───────────────────────────────

export async function createMonitoringRule(
  workspaceSlug: string,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (!ws) return { error: "Workspace not found" };

  const targetType = formData.get("targetType") as string;
  const targetId = formData.get("targetId") as string;
  const ruleType = formData.get("ruleType") as string;

  if (!targetType || !targetId || !ruleType) {
    return { error: "Missing required fields" };
  }

  // Build config based on rule type
  const config: Record<string, unknown> = {};
  if (ruleType === "source_refresh") {
    config.max_age_days = Number(formData.get("maxAgeDays")) || 30;
  } else if (ruleType === "threshold") {
    config.threshold = Number(formData.get("threshold")) || 50;
  } else if (ruleType === "missing_evidence") {
    config.stale_days = Number(formData.get("staleDays")) || 90;
  } else if (ruleType === "review_due") {
    config.review_days = Number(formData.get("reviewDays")) || 60;
  } else if (ruleType === "benchmark_change") {
    const codes = (formData.get("countryCodes") as string) ?? "";
    config.country_codes = codes
      .split(",")
      .map((c: string) => c.trim().toUpperCase())
      .filter(Boolean);
  } else if (ruleType === "eudr_risk_review") {
    config.review_days = Number(formData.get("reviewDays")) || 30;
  }

  const { error } = await admin.from("monitoring_rules").insert({
    workspace_id: ws.id,
    target_type: targetType,
    target_id: targetId,
    rule_type: ruleType,
    config,
  });

  if (error) return { error: error.message };

  await appendChangeLog(ws.id, user.id, "monitoring_rules", ws.id, "insert", null, {
    target_type: targetType, rule_type: ruleType, config,
  });

  revalidatePath(`/app/${workspaceSlug}/monitor`);
  return { success: true };
}

// ── Toggle Rule Active State ────────────────────────────

export async function toggleMonitoringRule(
  workspaceSlug: string,
  ruleId: string,
  isActive: boolean
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  const { error } = await admin
    .from("monitoring_rules")
    .update({ is_active: isActive })
    .eq("id", ruleId);

  if (error) return { error: error.message };

  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (ws) {
    await appendChangeLog(ws.id, user.id, "monitoring_rules", ruleId, "update", null, {
      is_active: isActive,
    });
  }

  revalidatePath(`/app/${workspaceSlug}/monitor`);
  return { success: true };
}

// ── Update Event Status ─────────────────────────────────

export async function updateEventStatus(
  workspaceSlug: string,
  eventId: string,
  status: string
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  const updateData: Record<string, unknown> = { status };
  if (status === "resolved") {
    updateData.resolved_at = new Date().toISOString();
  }

  const { error } = await admin
    .from("monitoring_events")
    .update(updateData)
    .eq("id", eventId);

  if (error) return { error: error.message };

  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (ws) {
    await appendChangeLog(ws.id, user.id, "monitoring_events", eventId, "status_change", null, {
      status, resolved_at: status === "resolved" ? new Date().toISOString() : null,
    });
  }

  revalidatePath(`/app/${workspaceSlug}/monitor`);
  return { success: true };
}

// ── Delete Monitoring Rule ──────────────────────────────

export async function deleteMonitoringRule(
  workspaceSlug: string,
  ruleId: string
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  const { error } = await admin
    .from("monitoring_rules")
    .delete()
    .eq("id", ruleId);

  if (error) return { error: error.message };

  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (ws) {
    await appendChangeLog(ws.id, user.id, "monitoring_rules", ruleId, "delete");
  }

  revalidatePath(`/app/${workspaceSlug}/monitor`);
  return { success: true };
}
