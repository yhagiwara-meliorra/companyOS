import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/analytics/members
 * Returns per-member analytics:
 * - Daily tone_score & politeness_score for last 14 days
 * - Scene label distribution per member
 */
export async function GET() {
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
    return NextResponse.json({ members: [] });
  }

  const db = createAdminClient();
  const orgId = membership.org_id;
  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Get all people in the org
  const { data: people } = await db
    .from("people")
    .select("id, display_name")
    .eq("org_id", orgId)
    .eq("is_active", true);

  if (!people || people.length === 0) {
    return NextResponse.json({ members: [] });
  }

  const personIds = people.map((p) => p.id);

  // 2. Get message_refs for the last 14 days for these people
  const { data: refs } = await db
    .schema("integrations")
    .from("message_refs")
    .select("id, person_id, sent_at")
    .eq("org_id", orgId)
    .in("person_id", personIds)
    .gte("sent_at", since14d)
    .order("sent_at", { ascending: true });

  if (!refs || refs.length === 0) {
    return NextResponse.json({
      members: people.map((p) => ({
        personId: p.id,
        displayName: p.display_name,
        dailyScores: [],
        sceneDistribution: [],
      })),
    });
  }

  // 3. Fetch analyses for these refs
  const refIds = refs.map((r) => r.id);
  // Batch in chunks of 100 to avoid too-large IN clauses
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

  // 4. Build per-person daily aggregates
  // Map: personId -> date -> { toneSum, politenessSum, count, scenes: Map<label, count> }
  type DayBucket = {
    toneSum: number;
    politenessSum: number;
    count: number;
    scenes: Map<string, number>;
  };
  const personDays = new Map<string, Map<string, DayBucket>>();

  for (const ref of refs) {
    if (!ref.person_id) continue;
    const scores = analysisMap.get(ref.id);
    if (!scores) continue;

    const dateStr = ref.sent_at.slice(0, 10); // YYYY-MM-DD

    if (!personDays.has(ref.person_id)) {
      personDays.set(ref.person_id, new Map());
    }
    const dayMap = personDays.get(ref.person_id)!;
    if (!dayMap.has(dateStr)) {
      dayMap.set(dateStr, { toneSum: 0, politenessSum: 0, count: 0, scenes: new Map() });
    }
    const bucket = dayMap.get(dateStr)!;

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
    }
  }

  // 5. Build response
  const members = people.map((person) => {
    const dayMap = personDays.get(person.id);

    // Daily scores array (sorted by date)
    const dailyScores: { date: string; tone: number; politeness: number; count: number }[] = [];
    // Aggregate scene distribution across all days
    const sceneTotal = new Map<string, number>();

    if (dayMap) {
      const sortedDates = [...dayMap.keys()].sort();
      for (const date of sortedDates) {
        const bucket = dayMap.get(date)!;
        if (bucket.count > 0) {
          dailyScores.push({
            date,
            tone: Math.round((bucket.toneSum / bucket.count) * 100) / 100,
            politeness: Math.round((bucket.politenessSum / bucket.count) * 100) / 100,
            count: bucket.count,
          });
        }
        for (const [label, count] of bucket.scenes) {
          sceneTotal.set(label, (sceneTotal.get(label) ?? 0) + count);
        }
      }
    }

    // Sort scene distribution by count descending
    const sceneDistribution = [...sceneTotal.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    return {
      personId: person.id,
      displayName: person.display_name,
      dailyScores,
      sceneDistribution,
    };
  });

  // Filter out members with no data and sort by total messages descending
  const membersWithData = members
    .filter((m) => m.dailyScores.length > 0 || m.sceneDistribution.length > 0)
    .sort((a, b) => {
      const aTotal = a.dailyScores.reduce((s, d) => s + d.count, 0);
      const bTotal = b.dailyScores.reduce((s, d) => s + d.count, 0);
      return bTotal - aTotal;
    });

  return NextResponse.json({ members: membersWithData });
}
