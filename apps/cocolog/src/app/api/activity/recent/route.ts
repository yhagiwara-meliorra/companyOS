import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/activity/recent
 * Returns recent message analyses for the current user's org (last 24h).
 * Used by the activity feed and hourly chart.
 */
export async function GET(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Get user's timezone from query params (fallback to UTC)
  const { searchParams } = new URL(request.url);
  const userTimezone = searchParams.get("tz") || "UTC";

  // Get user's org
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("profile_id", user.id)
    .single() as { data: { org_id: string } | null };

  if (!membership) {
    return NextResponse.json({ items: [], hourly: [] });
  }

  const db = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Fetch recent message_refs with analyses
  const { data: refs } = await db
    .schema("integrations")
    .from("message_refs")
    .select(
      "id, person_id, provider_channel_id, sent_at, channel_ref_id, sender_ref_id, permalink",
    )
    .eq("org_id", membership.org_id)
    .gte("sent_at", since)
    .order("sent_at", { ascending: false })
    .limit(50);

  if (!refs || refs.length === 0) {
    return NextResponse.json({ items: [], hourly: [] });
  }

  // Fetch analyses for these message_refs
  const refIds = refs.map((r) => r.id);
  const { data: analyses } = await db
    .schema("ai")
    .from("message_analyses")
    .select("message_ref_id, scores")
    .in("message_ref_id", refIds);

  const analysisMap = new Map<string, Record<string, unknown>>();
  for (const a of analyses ?? []) {
    analysisMap.set(a.message_ref_id, a.scores as Record<string, unknown>);
  }

  // Fetch external_users for sender info
  const senderRefIds = [...new Set(refs.map((r) => r.sender_ref_id).filter((id): id is string => !!id))];
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

  // Fetch external_channels for channel info
  const channelRefIds = [...new Set(refs.map((r) => r.channel_ref_id).filter((id): id is string => !!id))];
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

  // Build items
  const items = refs.map((ref) => {
    const scores = analysisMap.get(ref.id) ?? {};
    const sender = ref.sender_ref_id ? senderMap.get(ref.sender_ref_id) : null;
    const channelName = ref.channel_ref_id ? channelMap.get(ref.channel_ref_id) : null;

    return {
      id: ref.id,
      senderName: sender?.display_name ?? "不明",
      senderAvatar: sender?.avatar_url ?? null,
      channelName: channelName ?? ref.provider_channel_id,
      sentAt: ref.sent_at,
      permalink: ref.permalink,
      sceneLabel: (scores as Record<string, unknown>).scene_label ?? null,
      scores: Object.fromEntries(
        Object.entries(scores).filter(
          ([key]) => !["scene_label", "flags", "reasoning"].includes(key),
        ),
      ),
    };
  });

  // Build hourly distribution (last 24h) in user's timezone
  const hourly = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: 0,
  }));
  for (const ref of refs) {
    let hour: number;
    try {
      // Format the hour in the user's timezone
      const formatted = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: userTimezone,
      }).format(new Date(ref.sent_at));
      hour = parseInt(formatted, 10) % 24;
    } catch {
      // Invalid timezone — fallback to UTC
      hour = new Date(ref.sent_at).getUTCHours();
    }
    hourly[hour].count++;
  }

  return NextResponse.json({ items, hourly });
}
