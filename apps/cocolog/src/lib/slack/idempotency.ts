import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Check if an event was already processed using ops.idempotency_keys.
 * Tries to insert a new key — if it conflicts, the event is a duplicate.
 * Returns true if duplicate (already processed).
 */
export async function checkIdempotency(
  providerEventId: string,
): Promise<boolean> {
  const db = createAdminClient();
  const key = `slack_event:${providerEventId}`;

  const { error } = await db
    .schema("ops")
    .from("idempotency_keys")
    .insert({
      key,
      scope: "slack_events",
      response: { status: "processing" },
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

  // Unique constraint violation = duplicate
  if (error?.code === "23505") {
    return true;
  }

  // Log non-duplicate errors (e.g. schema not accessible, table missing)
  if (error) {
    console.error("[idempotency] insert failed (non-duplicate):", {
      error: error.message,
      code: error.code,
      key,
    });
  }

  return false;
}
