"use server";

import { createAdminClient } from "@/lib/db/admin";

/**
 * Append-only audit logger.
 * Inserts a record into the `change_log` table for compliance tracking.
 * This function is fire-and-forget — errors are logged but do not block the caller.
 */
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
  const { error } = await admin.from("change_log").insert({
    workspace_id: workspaceId,
    actor_user_id: userId,
    target_table: targetTable,
    target_id: targetId,
    action,
    before_state: beforeState ?? null,
    after_state: afterState ?? null,
  });
  if (error) console.error("[change-log] insert failed:", error.message);
}
