import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Daily rollup cron job.
 * Aggregates message_analyses from yesterday into person_daily_metrics.
 * Protected by CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split("T")[0];

  // Get active taxonomy version
  const { data: taxonomy } = await db
    .schema("ai")
    .from("taxonomy_versions")
    .select("id, signal_definitions")
    .eq("is_active", true)
    .single();

  if (!taxonomy) {
    return NextResponse.json({ error: "no active taxonomy" }, { status: 400 });
  }

  const signalKeys = Object.keys(
    taxonomy.signal_definitions as Record<string, unknown>,
  );

  // Get message analyses for yesterday
  const { data: analyses } = await db
    .schema("ai")
    .from("message_analyses")
    .select("id, scores, message_ref_id")
    .gte("created_at", `${dateStr}T00:00:00Z`)
    .lt("created_at", `${dateStr}T23:59:59Z`);

  if (!analyses || analyses.length === 0) {
    return NextResponse.json({
      message: "no analyses to rollup",
      date: dateStr,
    });
  }

  // Get the message_refs for these analyses to find org_id + person_id
  const refIds = analyses.map((a) => a.message_ref_id);
  const { data: refs } = await db
    .schema("integrations")
    .from("message_refs")
    .select("id, org_id, person_id")
    .in("id", refIds);

  if (!refs) {
    return NextResponse.json({ error: "no refs found" }, { status: 500 });
  }

  const refMap = new Map(refs.map((r) => [r.id, r]));

  // Group by org_id + person_id and aggregate metrics per signal
  const groups = new Map<
    string,
    {
      org_id: string;
      person_id: string;
      signalAggs: Record<
        string,
        { values: number[]; sum: number; min: number; max: number }
      >;
      messageCount: number;
    }
  >();

  for (const analysis of analyses) {
    const ref = refMap.get(analysis.message_ref_id);
    if (!ref || !ref.person_id) continue;

    const key = `${ref.org_id}:${ref.person_id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        org_id: ref.org_id,
        person_id: ref.person_id,
        signalAggs: {},
        messageCount: 0,
      });
    }

    const group = groups.get(key)!;
    group.messageCount++;

    const rawScores = analysis.scores as Record<string, unknown>;

    // Support both new format (scores.signals.{key}) and legacy (scores.{key})
    const signals = (
      rawScores.signals
        ? rawScores.signals
        : rawScores
    ) as Record<string, { value?: number; confidence?: number }>;

    for (const signalKey of signalKeys) {
      const score = signals[signalKey];
      if (!score || score.value == null) continue;

      if (!group.signalAggs[signalKey]) {
        group.signalAggs[signalKey] = {
          values: [],
          sum: 0,
          min: Infinity,
          max: -Infinity,
        };
      }

      const agg = group.signalAggs[signalKey];
      agg.values.push(score.value);
      agg.sum += score.value;
      agg.min = Math.min(agg.min, score.value);
      agg.max = Math.max(agg.max, score.value);
    }
  }

  // Build metrics JSONB and upsert
  const rows = Array.from(groups.values()).map((g) => {
    const metrics: Record<
      string,
      { avg: number; min: number; max: number; sum: number; count: number }
    > = {};

    for (const [signalKey, agg] of Object.entries(g.signalAggs)) {
      metrics[signalKey] = {
        avg: agg.sum / agg.values.length,
        min: agg.min,
        max: agg.max,
        sum: agg.sum,
        count: agg.values.length,
      };
    }

    return {
      org_id: g.org_id,
      person_id: g.person_id,
      date: dateStr,
      taxonomy_version_id: taxonomy.id,
      metrics,
      message_count: g.messageCount,
    };
  });

  const { error } = await db
    .schema("analytics")
    .from("person_daily_metrics")
    .upsert(rows, {
      onConflict: "org_id,person_id,date,taxonomy_version_id",
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: "daily rollup complete",
    date: dateStr,
    groups: rows.length,
  });
}
