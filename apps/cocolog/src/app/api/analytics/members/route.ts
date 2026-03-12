import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/analytics/members
 * Query params:
 *   personId  — "all" or a specific person UUID (default: "all")
 *   granularity — "daily" | "weekly" | "monthly" (default: "daily")
 *   days — lookback period in days (default: 30)
 *
 * Returns:
 *   people: [{ personId, displayName }]  — for the filter dropdown
 *   scores: [{ period, tone, politeness, count }]
 *   sceneDistribution: [{ label, count }]
 */
export async function GET(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("profile_id", user.id)
    .single() as { data: { org_id: string } | null };

  if (!membership) {
    return NextResponse.json({ people: [], scores: [], sceneDistribution: [] });
  }

  const { searchParams } = new URL(request.url);
  const personId = searchParams.get("personId") || "all";
  const granularity = searchParams.get("granularity") || "daily";
  const days = Math.min(parseInt(searchParams.get("days") || "30", 10) || 30, 365);

  const db = createAdminClient();
  const orgId = membership.org_id;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // 1. Always fetch people list for the filter dropdown
  const { data: people } = await db
    .from("people")
    .select("id, display_name")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("display_name");

  if (!people || people.length === 0) {
    return NextResponse.json({ people: [], scores: [], sceneDistribution: [] });
  }

  // 2. Fetch message_refs
  let refsQuery = db
    .schema("integrations")
    .from("message_refs")
    .select("id, person_id, sent_at")
    .eq("org_id", orgId)
    .gte("sent_at", since)
    .order("sent_at", { ascending: true });

  if (personId !== "all") {
    refsQuery = refsQuery.eq("person_id", personId);
  } else {
    const personIds = people.map((p) => p.id);
    refsQuery = refsQuery.in("person_id", personIds);
  }

  const { data: refs } = await refsQuery.limit(2000);

  if (!refs || refs.length === 0) {
    return NextResponse.json({
      people: people.map((p) => ({ personId: p.id, displayName: p.display_name })),
      scores: [],
      sceneDistribution: [],
    });
  }

  // 3. Fetch analyses
  const refIds = refs.map((r) => r.id);
  const allAnalyses: { message_ref_id: string; scores: Record<string, unknown> }[] = [];
  for (let i = 0; i < refIds.length; i += 100) {
    const chunk = refIds.slice(i, i + 100);
    const { data } = await db
      .schema("ai")
      .from("message_analyses")
      .select("message_ref_id, scores")
      .in("message_ref_id", chunk);
    if (data) allAnalyses.push(...(data as { message_ref_id: string; scores: Record<string, unknown> }[]));
  }

  const analysisMap = new Map<string, Record<string, unknown>>();
  for (const a of allAnalyses) {
    analysisMap.set(a.message_ref_id, a.scores);
  }

  // 4. Bucket by period
  type Bucket = { toneSum: number; politenessSum: number; count: number; scenes: Map<string, number> };
  const buckets = new Map<string, Bucket>();
  const sceneTotal = new Map<string, number>();

  for (const ref of refs) {
    const scores = analysisMap.get(ref.id);
    if (!scores) continue;

    const d = new Date(ref.sent_at);
    let periodKey: string;
    if (granularity === "weekly") {
      // ISO week: Monday as start
      const day = d.getUTCDay();
      const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setUTCDate(diff);
      periodKey = monday.toISOString().slice(0, 10);
    } else if (granularity === "monthly") {
      periodKey = d.toISOString().slice(0, 7); // YYYY-MM
    } else {
      periodKey = d.toISOString().slice(0, 10); // YYYY-MM-DD
    }

    if (!buckets.has(periodKey)) {
      buckets.set(periodKey, { toneSum: 0, politenessSum: 0, count: 0, scenes: new Map() });
    }
    const bucket = buckets.get(periodKey)!;

    const tone = typeof scores.tone_score === "number" ? scores.tone_score : null;
    const politeness = typeof scores.politeness_score === "number" ? scores.politeness_score : null;
    const sceneLabel = typeof scores.scene_label === "string" ? scores.scene_label : null;

    if (tone !== null && politeness !== null) {
      bucket.toneSum += tone;
      bucket.politenessSum += politeness;
      bucket.count++;
    }
    if (sceneLabel) {
      bucket.scenes.set(sceneLabel, (bucket.scenes.get(sceneLabel) ?? 0) + 1);
      sceneTotal.set(sceneLabel, (sceneTotal.get(sceneLabel) ?? 0) + 1);
    }
  }

  // 5. Build scores array
  const sortedPeriods = [...buckets.keys()].sort();
  const scoresList = sortedPeriods
    .map((period) => {
      const b = buckets.get(period)!;
      if (b.count === 0) return null;
      return {
        period,
        tone: Math.round((b.toneSum / b.count) * 100) / 100,
        politeness: Math.round((b.politenessSum / b.count) * 100) / 100,
        count: b.count,
      };
    })
    .filter(Boolean);

  // 6. Build scene distribution
  const sceneDistribution = [...sceneTotal.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    people: people.map((p) => ({ personId: p.id, displayName: p.display_name })),
    scores: scoresList,
    sceneDistribution,
  });
}
