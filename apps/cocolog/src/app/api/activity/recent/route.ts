import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/activity/recent
 * Returns today's message analyses for the current user's org.
 * "Today" is calculated in the user's timezone (via ?tz= param).
 */
export async function GET(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userTimezone = searchParams.get("tz") || "UTC";

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("profile_id", user.id)
    .single() as { data: { org_id: string } | null };

  if (!membership) {
    return NextResponse.json({ items: [], hourly: [], todayLabel: "" });
  }

  const db = createAdminClient();

  // Calculate today's boundaries in the user's timezone
  const { todayStart, todayEnd, todayLabel } = getTodayBounds(userTimezone);

  // Fetch today's message_refs (content column added in migration 00005)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: refs } = (await (db as any)
    .schema("integrations")
    .from("message_refs")
    .select(
      "id, person_id, provider_channel_id, sent_at, channel_ref_id, sender_ref_id, permalink, content",
    )
    .eq("org_id", membership.org_id)
    .gte("sent_at", todayStart.toISOString())
    .lt("sent_at", todayEnd.toISOString())
    .order("sent_at", { ascending: false })
    .limit(200)) as {
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

  if (!refs || refs.length === 0) {
    return NextResponse.json({ items: [], hourly: [], todayLabel });
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
      content: ref.content ?? null,
      sceneLabel: (scores as Record<string, unknown>).scene_label ?? null,
      scores: Object.fromEntries(
        Object.entries(scores).filter(
          ([key]) => !["scene_label", "flags", "reasoning"].includes(key),
        ),
      ),
    };
  });

  // Build hourly distribution (today) in user's timezone
  const hourly = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: 0,
  }));
  for (const ref of refs) {
    let hour: number;
    try {
      const formatted = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: userTimezone,
      }).format(new Date(ref.sent_at));
      hour = parseInt(formatted, 10) % 24;
    } catch {
      hour = new Date(ref.sent_at).getUTCHours();
    }
    hourly[hour].count++;
  }

  return NextResponse.json({ items, hourly, todayLabel });
}

/**
 * Calculate the UTC boundaries of "today" in a given timezone.
 */
function getTodayBounds(tz: string) {
  try {
    const now = new Date();

    // Get current time-of-day in the user's timezone
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
      timeZone: tz,
    }).formatToParts(now);

    const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
    const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
    const s = parseInt(parts.find((p) => p.type === "second")?.value ?? "0");

    // Midnight in user's TZ = now - elapsed time since midnight
    const msSinceMidnight = (h * 3600 + m * 60 + s) * 1000;
    const todayStart = new Date(now.getTime() - msSinceMidnight);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // Format today's date label
    const todayLabel = new Intl.DateTimeFormat("ja-JP", {
      month: "long",
      day: "numeric",
      weekday: "short",
      timeZone: tz,
    }).format(now);

    return { todayStart, todayEnd, todayLabel };
  } catch {
    // Fallback to UTC
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    return { todayStart, todayEnd, todayLabel: now.toLocaleDateString("ja-JP") };
  }
}
