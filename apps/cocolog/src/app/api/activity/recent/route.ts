import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const PAGE_SIZE = 50;

/**
 * GET /api/activity/recent
 * Returns message analyses for a given date (default: today).
 *
 * Query params:
 *   tz        — IANA timezone (default: UTC)
 *   date      — YYYY-MM-DD in user's timezone (default: today)
 *   page      — 1-based page number (default: 1)
 *   senderId  — external_users.id to filter by sender (default: "all")
 *   channelId — external_channels.id to filter by channel (default: "all")
 *   riskOnly  — "true" to only show harassment-risk messages (score ≤ 30)
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
  const dateParam = searchParams.get("date"); // YYYY-MM-DD or null (= today)
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const senderId = searchParams.get("senderId") || "all";
  const channelId = searchParams.get("channelId") || "all";
  const riskOnly = searchParams.get("riskOnly") === "true";

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("profile_id", user.id)
    .single() as { data: { org_id: string } | null };

  if (!membership) {
    return NextResponse.json({ items: [], hourly: [], dateLabel: "", totalCount: 0, page: 1, pageSize: PAGE_SIZE, senders: [], channels: [] });
  }

  const db = createAdminClient();

  // ── Fetch filter options (available senders & channels for this org) ──
  const { data: connection } = await db
    .schema("integrations")
    .from("connections")
    .select("id")
    .eq("org_id", membership.org_id)
    .eq("provider", "slack")
    .eq("status", "active")
    .single();

  const senderOptions: { id: string; displayName: string }[] = [];
  const channelOptions: { id: string; channelName: string }[] = [];

  // ── Channel-scoping: restrict to channels the logged-in user participates in ──
  // If we CAN identify the user's channels → scope to those (privacy).
  // If we CANNOT (no matching external_user, or no messages yet) → show all (graceful fallback).
  let allowedChannelIds: string[] | null = null;

  if (connection) {
    const userEmail = user.email?.toLowerCase();
    if (userEmail) {
      const { data: myExtUser } = await db
        .schema("integrations")
        .from("external_users")
        .select("id")
        .eq("connection_id", connection.id)
        .ilike("email", userEmail)
        .maybeSingle();

      if (myExtUser) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: channelRefs } = await (db as any)
          .schema("integrations")
          .from("message_refs")
          .select("channel_ref_id")
          .eq("sender_ref_id", myExtUser.id)
          .not("channel_ref_id", "is", null)
          .limit(10000);

        const refs_list = (channelRefs ?? []) as { channel_ref_id: string | null }[];
        const ids: string[] = refs_list
          .map((r) => r.channel_ref_id)
          .filter((id): id is string => typeof id === "string");
        // Only apply scoping when we have positive channel IDs
        if (ids.length > 0) {
          allowedChannelIds = [...new Set(ids)];
        }
      }
    }

    const { data: users } = await db
      .schema("integrations")
      .from("external_users")
      .select("id, display_name")
      .eq("connection_id", connection.id)
      .order("display_name");
    for (const u of users ?? []) {
      senderOptions.push({ id: u.id, displayName: u.display_name });
    }

    const { data: chans } = await db
      .schema("integrations")
      .from("external_channels")
      .select("id, channel_name")
      .eq("connection_id", connection.id)
      .order("channel_name");
    for (const c of chans ?? []) {
      // Only filter channels if scoping is active
      if (!allowedChannelIds || allowedChannelIds.includes(c.id)) {
        channelOptions.push({ id: c.id, channelName: c.channel_name });
      }
    }
  }

  // Calculate day boundaries
  const { dayStart, dayEnd, dateLabel } = dateParam
    ? getDateBounds(dateParam, userTimezone)
    : getTodayBounds(userTimezone);

  // Helper: apply common filters to a query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters(query: any) {
    let q = query;
    if (senderId !== "all") q = q.eq("sender_ref_id", senderId);
    if (channelId !== "all") q = q.eq("channel_ref_id", channelId);
    if (allowedChannelIds && allowedChannelIds.length > 0) q = q.in("channel_ref_id", allowedChannelIds);
    return q;
  }

  // ──────────────────────────────────────────────────────────
  // riskOnly mode: fetch more refs, filter by analysis scores
  // ──────────────────────────────────────────────────────────
  if (riskOnly) {
    // Fetch a large batch for the day (up to 1000)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let batchQuery = (db as any)
      .schema("integrations")
      .from("message_refs")
      .select("id, person_id, provider_channel_id, sent_at, channel_ref_id, sender_ref_id, permalink, content")
      .eq("org_id", membership.org_id)
      .gte("sent_at", dayStart.toISOString())
      .lt("sent_at", dayEnd.toISOString());
    batchQuery = applyFilters(batchQuery);
    const { data: batchRefs } = (await batchQuery
      .order("sent_at", { ascending: false })
      .limit(1000)) as { data: RefRow[] | null };

    if (!batchRefs || batchRefs.length === 0) {
      return NextResponse.json({
        items: [],
        hourly: buildHourly([], userTimezone),
        dateLabel,
        totalCount: 0,
        page,
        pageSize: PAGE_SIZE,
        senders: senderOptions,
        channels: channelOptions,
      });
    }

    // Fetch analyses for all batch refs
    const refIds = batchRefs.map((r) => r.id);
    const analysisMap = await fetchAnalyses(db, refIds);

    // Filter for risk: tone_score <= 0.30 OR politeness_score <= 0.30
    const riskRefs = batchRefs.filter((ref) => {
      const scores = analysisMap.get(ref.id);
      if (!scores) return false;
      const tone = typeof scores.tone_score === "number" ? scores.tone_score : null;
      const politeness = typeof scores.politeness_score === "number" ? scores.politeness_score : null;
      return (tone !== null && tone <= 0.30) || (politeness !== null && politeness <= 0.30);
    });

    const riskTotal = riskRefs.length;
    const riskOffset = (page - 1) * PAGE_SIZE;
    const riskPage = riskRefs.slice(riskOffset, riskOffset + PAGE_SIZE);

    // Build hourly from ALL matching refs (not just risk)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let hourlyQuery = (db as any)
      .schema("integrations")
      .from("message_refs")
      .select("sent_at")
      .eq("org_id", membership.org_id)
      .gte("sent_at", dayStart.toISOString())
      .lt("sent_at", dayEnd.toISOString());
    hourlyQuery = applyFilters(hourlyQuery);
    const { data: allHourlyRefs } = (await hourlyQuery) as { data: { sent_at: string }[] | null };
    const hourly = buildHourly(allHourlyRefs ?? [], userTimezone);

    // Enrich risk page with sender/channel info
    const items = await enrichItems(db, riskPage, analysisMap);

    return NextResponse.json({
      items,
      hourly,
      dateLabel,
      totalCount: riskTotal,
      page,
      pageSize: PAGE_SIZE,
      senders: senderOptions,
      channels: channelOptions,
    });
  }

  // ──────────────────────────────────────────────────
  // Normal mode: efficient DB-level pagination
  // ──────────────────────────────────────────────────

  // Count total items for the day
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQuery = (db as any)
    .schema("integrations")
    .from("message_refs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", membership.org_id)
    .gte("sent_at", dayStart.toISOString())
    .lt("sent_at", dayEnd.toISOString());
  countQuery = applyFilters(countQuery);
  const { count: totalCount } = (await countQuery) as { count: number | null };

  // Fetch ALL refs for hourly chart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let hourlyQuery = (db as any)
    .schema("integrations")
    .from("message_refs")
    .select("sent_at")
    .eq("org_id", membership.org_id)
    .gte("sent_at", dayStart.toISOString())
    .lt("sent_at", dayEnd.toISOString());
  hourlyQuery = applyFilters(hourlyQuery);
  const { data: allRefs } = (await hourlyQuery) as { data: { sent_at: string }[] | null };
  const hourly = buildHourly(allRefs ?? [], userTimezone);

  // Fetch paginated message_refs
  const offset = (page - 1) * PAGE_SIZE;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let refsQuery = (db as any)
    .schema("integrations")
    .from("message_refs")
    .select("id, person_id, provider_channel_id, sent_at, channel_ref_id, sender_ref_id, permalink, content")
    .eq("org_id", membership.org_id)
    .gte("sent_at", dayStart.toISOString())
    .lt("sent_at", dayEnd.toISOString());
  refsQuery = applyFilters(refsQuery);
  const { data: refs } = (await refsQuery
    .order("sent_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)) as { data: RefRow[] | null };

  if (!refs || refs.length === 0) {
    return NextResponse.json({
      items: [],
      hourly,
      dateLabel,
      totalCount: totalCount ?? 0,
      page,
      pageSize: PAGE_SIZE,
      senders: senderOptions,
      channels: channelOptions,
    });
  }

  // Fetch analyses + enrich items
  const refIds = refs.map((r) => r.id);
  const analysisMap = await fetchAnalyses(db, refIds);
  const items = await enrichItems(db, refs, analysisMap);

  return NextResponse.json({
    items,
    hourly,
    dateLabel,
    totalCount: totalCount ?? 0,
    page,
    pageSize: PAGE_SIZE,
    senders: senderOptions,
    channels: channelOptions,
  });
}

// ── Types ──

type RefRow = {
  id: string;
  person_id: string | null;
  provider_channel_id: string;
  sent_at: string;
  channel_ref_id: string | null;
  sender_ref_id: string | null;
  permalink: string | null;
  content: string | null;
};

// ── Helper: Build hourly distribution ──
function buildHourly(refs: { sent_at: string }[], tz: string) {
  const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
  for (const ref of refs) {
    let hour: number;
    try {
      const formatted = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: tz,
      }).format(new Date(ref.sent_at));
      hour = parseInt(formatted, 10) % 24;
    } catch {
      hour = new Date(ref.sent_at).getUTCHours();
    }
    hourly[hour].count++;
  }
  return hourly;
}

// ── Helper: Fetch analyses for a batch of ref IDs ──
async function fetchAnalyses(
  db: ReturnType<typeof createAdminClient>,
  refIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < refIds.length; i += 100) {
    const chunk = refIds.slice(i, i + 100);
    const { data } = await db
      .schema("ai")
      .from("message_analyses")
      .select("message_ref_id, scores")
      .in("message_ref_id", chunk);
    for (const a of data ?? []) {
      map.set(a.message_ref_id, a.scores as Record<string, unknown>);
    }
  }
  return map;
}

// ── Helper: Enrich refs with sender/channel info + build response items ──
async function enrichItems(
  db: ReturnType<typeof createAdminClient>,
  refs: RefRow[],
  analysisMap: Map<string, Record<string, unknown>>,
) {
  // Fetch sender info
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

  // Fetch channel info
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

  return refs.map((ref) => {
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
}

// ── Date helpers ──

function getTodayBounds(tz: string) {
  try {
    const now = new Date();
    const dateStr = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: tz,
    }).format(now);
    return getDateBounds(dateStr, tz);
  } catch {
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    return { dayStart, dayEnd, dateLabel: now.toLocaleDateString("ja-JP") };
  }
}

function getDateBounds(dateStr: string, tz: string) {
  try {
    const [y, mo, d] = dateStr.split("-").map(Number);
    if (!y || !mo || !d) throw new Error("invalid date");

    const noonUtc = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
      timeZone: tz,
    }).formatToParts(noonUtc);

    const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "12") % 24;
    const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
    const offsetMinutes = (h * 60 + m) - (12 * 60);

    const midnightUtc = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0) - offsetMinutes * 60 * 1000);
    const endUtc = new Date(midnightUtc.getTime() + 24 * 60 * 60 * 1000);

    const labelDate = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
    const dateLabel = new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      timeZone: tz,
    }).format(labelDate);

    return { dayStart: midnightUtc, dayEnd: endUtc, dateLabel };
  } catch {
    const [y, mo, d] = dateStr.split("-").map(Number);
    const dayStart = new Date(Date.UTC(y || 2026, (mo || 1) - 1, d || 1));
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    return { dayStart, dayEnd, dateLabel: dateStr };
  }
}
