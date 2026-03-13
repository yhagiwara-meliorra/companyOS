import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/admin/debug-slack
 * Temporary debug endpoint to diagnose Slack API issues.
 * Returns token scopes and tests individual API calls.
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
    .select("org_id, role")
    .eq("profile_id", user.id)
    .single() as { data: { org_id: string; role: string } | null };

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = createAdminClient();

  const { data: connection } = await db
    .schema("integrations")
    .from("connections")
    .select("id")
    .eq("org_id", membership.org_id)
    .eq("provider", "slack")
    .eq("status", "active")
    .single();

  if (!connection) {
    return NextResponse.json({ error: "no_connection" }, { status: 404 });
  }

  const { data: installation } = await db
    .schema("integrations")
    .from("installations")
    .select("bot_token, provider_team_id, scopes, revoked_at, installed_at")
    .eq("connection_id", connection.id)
    .is("revoked_at", null)
    .single();

  if (!installation) {
    return NextResponse.json({ error: "no_installation" }, { status: 404 });
  }

  const token = installation.bot_token;
  const results: Record<string, unknown> = {
    dbScopes: installation.scopes,
    installedAt: installation.installed_at,
    revokedAt: installation.revoked_at,
    tokenPrefix: token?.substring(0, 20) + "...",
  };

  // 1. auth.test
  try {
    const authRes = await slackFetch(token, "auth.test");
    results.authTest = authRes;
  } catch (err) {
    results.authTest = { error: String(err) };
  }

  // 2. Test users.info with first stale user
  const { data: staleUser } = await db
    .schema("integrations")
    .from("external_users")
    .select("provider_user_id, display_name")
    .eq("connection_id", connection.id)
    .like("display_name", "user-%")
    .limit(1)
    .single();

  if (staleUser) {
    results.testUserId = staleUser.provider_user_id;
    try {
      const userRes = await slackFetch(token, "users.info", { user: staleUser.provider_user_id });
      results.usersInfo = userRes;
    } catch (err) {
      results.usersInfo = { error: String(err) };
    }

    // Also try users.list to see if we can list ANY users
    try {
      const listRes = await slackFetch(token, "users.list", { limit: 3 });
      // Only return member count and first few names for safety
      const members = (listRes as { members?: { id: string; name: string; real_name: string }[] }).members ?? [];
      results.usersList = {
        ok: (listRes as { ok: boolean }).ok,
        count: members.length,
        sample: members.slice(0, 3).map((m) => ({ id: m.id, name: m.name })),
      };
    } catch (err) {
      results.usersList = { error: String(err) };
    }
  }

  // 3. Test conversations.info with first stale channel
  const { data: staleChannels } = await db
    .schema("integrations")
    .from("external_channels")
    .select("provider_channel_id, channel_name")
    .eq("connection_id", connection.id);

  const staleChannel = (staleChannels ?? []).find((ch) =>
    /^C[A-Z0-9]{8,}$/i.test(ch.channel_name),
  );

  if (staleChannel) {
    results.testChannelId = staleChannel.provider_channel_id;
    try {
      const chanRes = await slackFetch(token, "conversations.info", { channel: staleChannel.provider_channel_id });
      results.conversationsInfo = chanRes;
    } catch (err) {
      results.conversationsInfo = { error: String(err) };
    }

    // Also try conversations.list
    try {
      const listRes = await slackFetch(token, "conversations.list", { limit: 3 });
      const channels = (listRes as { channels?: { id: string; name: string }[] }).channels ?? [];
      results.conversationsList = {
        ok: (listRes as { ok: boolean }).ok,
        count: channels.length,
        sample: channels.slice(0, 3).map((c) => ({ id: c.id, name: c.name })),
      };
    } catch (err) {
      results.conversationsList = { error: String(err) };
    }
  }

  return NextResponse.json(results);
}

async function slackFetch(token: string, method: string, params?: Record<string, unknown>) {
  const formBody = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        formBody.append(key, String(value));
      }
    }
  }
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody.toString(),
  });
  return res.json();
}
