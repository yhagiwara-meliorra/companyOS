import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Weekly rollup cron job.
 * Aggregates person_daily_metrics from the past week into person_weekly_metrics.
 * Also computes org_weekly_metrics.
 * Protected by CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  // Calculate last week's Monday
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - dayOfWeek - 6);
  const weekStart = lastMonday.toISOString().split("T")[0];

  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  const weekEnd = lastSunday.toISOString().split("T")[0];

  // Get active taxonomy
  const { data: taxonomy } = await db
    .schema("ai")
    .from("taxonomy_versions")
    .select("id")
    .eq("is_active", true)
    .single();

  if (!taxonomy) {
    return NextResponse.json({ error: "no active taxonomy" }, { status: 400 });
  }

  // Get daily metrics for the week
  const { data: dailyMetrics } = await db
    .schema("analytics")
    .from("person_daily_metrics")
    .select("org_id, person_id, metrics, message_count, taxonomy_version_id")
    .gte("date", weekStart)
    .lte("date", weekEnd);

  if (!dailyMetrics || dailyMetrics.length === 0) {
    return NextResponse.json({ message: "no daily metrics to roll up", weekStart });
  }

  // Group by org_id + person_id
  const groups = new Map<
    string,
    {
      org_id: string;
      person_id: string;
      taxonomy_version_id: string;
      signalAggs: Record<
        string,
        { sum: number; count: number; min: number; max: number }
      >;
      totalMessages: number;
    }
  >();

  for (const row of dailyMetrics) {
    const key = `${row.org_id}:${row.person_id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        org_id: row.org_id,
        person_id: row.person_id,
        taxonomy_version_id: row.taxonomy_version_id,
        signalAggs: {},
        totalMessages: 0,
      });
    }

    const group = groups.get(key)!;
    group.totalMessages += row.message_count;

    const metrics = row.metrics as Record<
      string,
      { avg: number; min: number; max: number; sum: number; count: number }
    >;

    for (const [signalKey, val] of Object.entries(metrics)) {
      if (!group.signalAggs[signalKey]) {
        group.signalAggs[signalKey] = {
          sum: 0,
          count: 0,
          min: Infinity,
          max: -Infinity,
        };
      }
      const agg = group.signalAggs[signalKey];
      agg.sum += val.sum;
      agg.count += val.count;
      agg.min = Math.min(agg.min, val.min);
      agg.max = Math.max(agg.max, val.max);
    }
  }

  // Get previous week's metrics for trend calculation
  const prevWeekStart = new Date(lastMonday);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekStartStr = prevWeekStart.toISOString().split("T")[0];

  const personIds = [...new Set(Array.from(groups.values()).map((g) => g.person_id))];
  const { data: prevWeekRows } = await db
    .schema("analytics")
    .from("person_weekly_metrics")
    .select("person_id, metrics")
    .eq("week_start", prevWeekStartStr)
    .in("person_id", personIds);

  const prevMap = new Map(
    (prevWeekRows ?? []).map((r) => [r.person_id, r.metrics]),
  );

  // Build weekly rows
  const weeklyRows = Array.from(groups.values()).map((g) => {
    const metrics: Record<
      string,
      { avg: number; min: number; max: number; sum: number; count: number }
    > = {};

    for (const [signalKey, agg] of Object.entries(g.signalAggs)) {
      metrics[signalKey] = {
        avg: agg.count > 0 ? agg.sum / agg.count : 0,
        min: agg.min === Infinity ? 0 : agg.min,
        max: agg.max === -Infinity ? 0 : agg.max,
        sum: agg.sum,
        count: agg.count,
      };
    }

    return {
      org_id: g.org_id,
      person_id: g.person_id,
      week_start: weekStart,
      taxonomy_version_id: g.taxonomy_version_id,
      metrics,
      message_count: g.totalMessages,
      prev_week_metrics: prevMap.get(g.person_id)
        ? JSON.parse(JSON.stringify(prevMap.get(g.person_id)))
        : null,
    };
  });

  const { error: weeklyError } = await db
    .schema("analytics")
    .from("person_weekly_metrics")
    .upsert(weeklyRows, {
      onConflict: "org_id,person_id,week_start,taxonomy_version_id",
    });

  if (weeklyError) {
    return NextResponse.json({ error: weeklyError.message }, { status: 500 });
  }

  // Compute org-level weekly metrics
  const orgGroups = new Map<
    string,
    {
      org_id: string;
      signalAggs: Record<string, { sum: number; count: number }>;
      totalMessages: number;
      activePeople: Set<string>;
    }
  >();

  for (const g of groups.values()) {
    if (!orgGroups.has(g.org_id)) {
      orgGroups.set(g.org_id, {
        org_id: g.org_id,
        signalAggs: {},
        totalMessages: 0,
        activePeople: new Set(),
      });
    }
    const og = orgGroups.get(g.org_id)!;
    og.totalMessages += g.totalMessages;
    og.activePeople.add(g.person_id);

    for (const [signalKey, agg] of Object.entries(g.signalAggs)) {
      if (!og.signalAggs[signalKey]) {
        og.signalAggs[signalKey] = { sum: 0, count: 0 };
      }
      og.signalAggs[signalKey].sum += agg.sum;
      og.signalAggs[signalKey].count += agg.count;
    }
  }

  const orgRows = Array.from(orgGroups.values()).map((og) => {
    const metrics: Record<string, { avg: number; count: number }> = {};
    for (const [key, agg] of Object.entries(og.signalAggs)) {
      metrics[key] = {
        avg: agg.count > 0 ? agg.sum / agg.count : 0,
        count: agg.count,
      };
    }

    return {
      org_id: og.org_id,
      week_start: weekStart,
      taxonomy_version_id: taxonomy.id,
      metrics,
      active_people_count: og.activePeople.size,
      total_message_count: og.totalMessages,
    };
  });

  await db
    .schema("analytics")
    .from("org_weekly_metrics")
    .upsert(orgRows, {
      onConflict: "org_id,week_start,taxonomy_version_id",
    });

  return NextResponse.json({
    message: "weekly rollup complete",
    weekStart,
    personGroups: weeklyRows.length,
    orgGroups: orgRows.length,
  });
}
