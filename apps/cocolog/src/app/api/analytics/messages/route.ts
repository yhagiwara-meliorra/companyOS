import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const PAGE_SIZE = 30;

/**
 * GET /api/analytics/messages
 * Returns individual messages with their analysis scores for the personal analysis tab.
 *
 * Query params:
 *   personId  — "all" or a specific person UUID (default: "all")
 *   riskOnly  — "true" to filter for harassment risk (tone_score <= 0.30)
 *   page      — 1-based page number (default: 1)
 *   days      — lookback period in days (default: 30)
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
    return NextResponse.json({ messages: [], totalCount: 0, page: 1, pageSize: PAGE_SIZE });
  }

  const { searchParams } = new URL(request.url);
  const personId = searchParams.get("personId") || "all";
  const riskOnly = searchParams.get("riskOnly") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const days = Math.min(parseInt(searchParams.get("days") || "30", 10) || 30, 365);

  const db = createAdminClient();
  const orgId = membership.org_id;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Get active people for filtering
  const { data: people } = await db
    .from("people")
    .select("id, display_name")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("display_name");

  if (!people || people.length === 0) {
    return NextResponse.json({ messages: [], totalCount: 0, page: 1, pageSize: PAGE_SIZE });
  }

  // Fetch message_refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let refsQuery = (db as any)
    .schema("integrations")
    .from("message_refs")
    .select("id, person_id, provider_channel_id, sent_at, channel_ref_id, sender_ref_id, permalink, content")
    .eq("org_id", orgId)
    .gte("sent_at", since)
    .order("sent_at", { ascending: false });

  if (personId !== "all") {
    refsQuery = refsQuery.eq("person_id", personId);
  } else {
    const personIds = people.map((p) => p.id);
    refsQuery = refsQuery.in("person_id", personIds);
  }

  // Fetch more than a page so we can filter by risk and still have results
  const fetchLimit = riskOnly ? 2000 : PAGE_SIZE * 3;
  const { data: allRefs } = (await refsQuery.limit(fetchLimit)) as {
    data: {
      id: string;
      person_id: string | null;
      provider_channel_id: string;
      sent_at: string;
      channel_ref_id: string | null;
      sender_ref_id: string | null;
      permalink: string | null;
      content: string | null;
    }[] | null;
  };

  if (!allRefs || allRefs.length === 0) {
    return NextResponse.json({ messages: [], totalCount: 0, page, pageSize: PAGE_SIZE });
  }

  // Fetch analyses for all refs
  const refIds = allRefs.map((r) => r.id);
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

  // Build message list, applying risk filter if needed
  type MessageWithScores = {
    ref: (typeof allRefs)[number];
    scores: Record<string, unknown>;
    toneScore: number | null;
    politenessScore: number | null;
  };

  const filteredMessages: MessageWithScores[] = [];
  for (const ref of allRefs) {
    const scores = analysisMap.get(ref.id);
    if (!scores) continue;

    const toneScore = typeof scores.tone_score === "number" ? scores.tone_score : null;
    const politenessScore = typeof scores.politeness_score === "number" ? scores.politeness_score : null;

    if (riskOnly) {
      // Show messages with tone_score <= 0.30 OR politeness_score <= 0.30
      if ((toneScore !== null && toneScore <= 0.30) || (politenessScore !== null && politenessScore <= 0.30)) {
        filteredMessages.push({ ref, scores, toneScore, politenessScore });
      }
    } else {
      filteredMessages.push({ ref, scores, toneScore, politenessScore });
    }
  }

  const totalCount = filteredMessages.length;

  // Paginate
  const offset = (page - 1) * PAGE_SIZE;
  const pageMessages = filteredMessages.slice(offset, offset + PAGE_SIZE);

  // Fetch sender info
  const senderRefIds = [...new Set(pageMessages.map((m) => m.ref.sender_ref_id).filter((id): id is string => !!id))];
  const senderMap = new Map<string, { display_name: string; avatar_url: string | null }>();
  if (senderRefIds.length > 0) {
    const { data: senders } = await db
      .schema("integrations")
      .from("external_users")
      .select("id, display_name, avatar_url")
      .in("id", senderRefIds);
    for (const s of senders ?? []) {
      senderMap.set(s.id, { display_name: s.display_name, avatar_url: s.avatar_url });
    }
  }

  // Fetch channel info
  const channelRefIds = [...new Set(pageMessages.map((m) => m.ref.channel_ref_id).filter((id): id is string => !!id))];
  const channelMap = new Map<string, string>();
  if (channelRefIds.length > 0) {
    const { data: channels } = await db
      .schema("integrations")
      .from("external_channels")
      .select("id, channel_name")
      .in("id", channelRefIds);
    for (const c of channels ?? []) {
      channelMap.set(c.id, c.channel_name);
    }
  }

  // Build response items
  const messages = pageMessages.map((m) => {
    const sender = m.ref.sender_ref_id ? senderMap.get(m.ref.sender_ref_id) : null;
    const channelName = m.ref.channel_ref_id ? channelMap.get(m.ref.channel_ref_id) : null;

    return {
      id: m.ref.id,
      senderName: sender?.display_name ?? "不明",
      senderAvatar: sender?.avatar_url ?? null,
      channelName: channelName ?? m.ref.provider_channel_id,
      sentAt: m.ref.sent_at,
      permalink: m.ref.permalink,
      content: m.ref.content ?? null,
      sceneLabel: (m.scores.scene_label as string) ?? null,
      toneScore: m.toneScore,
      politenessScore: m.politenessScore,
      scores: Object.fromEntries(
        Object.entries(m.scores).filter(
          ([key]) => !["scene_label", "flags", "reasoning"].includes(key),
        ),
      ),
    };
  });

  return NextResponse.json({
    messages,
    totalCount,
    page,
    pageSize: PAGE_SIZE,
  });
}
