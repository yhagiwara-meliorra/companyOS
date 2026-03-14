import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/analytics/improvements
 * Returns improvement usage stats for the dashboard.
 *
 * Query params:
 *   days — lookback period in days (default: 30, max: 365)
 *
 * Returns:
 *   totalCount      — total improvement requests in the window
 *   uniqueUsers     — distinct Slack users who used /improve
 *   sceneDistribution — { scene_label: count }
 *   recentDays      — last 7 days of usage [{ date, count }]
 *   avgLatencyMs    — average Claude API latency
 */
export async function GET(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Get user's org via membership
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("profile_id", user.id)
    .single() as { data: { org_id: string } | null };

  if (!membership) {
    return NextResponse.json({
      totalCount: 0,
      uniqueUsers: 0,
      sceneDistribution: {},
      recentDays: [],
      avgLatencyMs: null,
    });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(
    parseInt(searchParams.get("days") || "30", 10) || 30,
    365,
  );
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const db = createAdminClient();

  // Fetch improvement requests for this org in the window
  const { data: requests } = await db
    .schema("ai")
    .from("improvement_requests")
    .select("id, provider_user_id, scene_label, latency_ms, created_at")
    .eq("org_id", membership.org_id)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const allRequests = requests ?? [];
  const totalCount = allRequests.length;
  const uniqueUsers = new Set(
    allRequests.map((r) => r.provider_user_id),
  ).size;

  // Scene distribution
  const sceneDistribution: Record<string, number> = {};
  for (const r of allRequests) {
    if (r.scene_label) {
      sceneDistribution[r.scene_label] =
        (sceneDistribution[r.scene_label] ?? 0) + 1;
    }
  }

  // Daily usage for the last 7 days
  const recentDays: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    const count = allRequests.filter((r) =>
      r.created_at.startsWith(dateStr),
    ).length;
    recentDays.push({ date: dateStr, count });
  }

  // Average latency
  const latencies = allRequests
    .filter((r) => r.latency_ms != null)
    .map((r) => r.latency_ms as number);
  const avgLatencyMs =
    latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;

  return NextResponse.json({
    totalCount,
    uniqueUsers,
    sceneDistribution,
    recentDays,
    avgLatencyMs,
  });
}
