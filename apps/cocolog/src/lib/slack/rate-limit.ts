import { createAdminClient } from "@/lib/supabase/admin";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
}

/**
 * Check rate limit for /improve usage.
 * Uses a sliding window of 1 hour, counting rows in ai.improvement_requests.
 *
 * Limits:
 *   free tier:  10 requests/hour
 *   pro tier:   50 requests/hour
 *   enterprise: 50 requests/hour
 */
export async function checkImproveRateLimit(
  providerUserId: string,
  providerTeamId: string,
  orgId: string,
): Promise<RateLimitResult> {
  const db = createAdminClient();

  // Determine plan tier from the organization
  const { data: org } = await db
    .from("organizations")
    .select("plan")
    .eq("id", orgId)
    .single();

  const plan = (org?.plan as string) ?? "free";
  const limit = plan === "free" ? 10 : 50;

  // Count requests within the sliding window (1 hour)
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count } = await db
    .schema("ai")
    .from("improvement_requests")
    .select("id", { count: "exact", head: true })
    .eq("provider_user_id", providerUserId)
    .eq("provider_team_id", providerTeamId)
    .gte("created_at", windowStart);

  const used = count ?? 0;
  const remaining = Math.max(0, limit - used);

  return {
    allowed: used < limit,
    remaining,
    limit,
    resetAt: new Date(Date.now() + 60 * 60 * 1000),
  };
}
