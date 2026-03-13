import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SlackClient } from "@/lib/slack/client";

export const runtime = "nodejs";

/**
 * POST /api/admin/refresh-names
 * Re-fetches stale user names and channel names from Slack API.
 * Requires owner/admin role.
 */
export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Verify owner/admin
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("profile_id", user.id)
    .single() as { data: { org_id: string; role: string } | null };

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = createAdminClient();
  const orgId = membership.org_id;

  // Find active Slack installation
  const { data: connection } = await db
    .schema("integrations")
    .from("connections")
    .select("id")
    .eq("org_id", orgId)
    .eq("provider", "slack")
    .eq("status", "active")
    .single();

  if (!connection) {
    return NextResponse.json({ error: "no_active_connection", message: "Slackが接続されていません。" }, { status: 404 });
  }

  const { data: installation } = await db
    .schema("integrations")
    .from("installations")
    .select("bot_token, provider_team_id")
    .eq("connection_id", connection.id)
    .is("revoked_at", null)
    .single();

  if (!installation) {
    return NextResponse.json({ error: "no_installation", message: "有効なSlackインストールが見つかりません。" }, { status: 404 });
  }

  const slack = new SlackClient(installation.bot_token);

  // Verify bot token is valid and gather debug info
  let authInfo: { team_id?: string; team?: string; user_id?: string; bot_id?: string } = {};
  try {
    authInfo = await slack.apiCall<typeof authInfo>("auth.test");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      error: "invalid_token",
      message: `Botトークンが無効です。Slack Appの再インストールを試してください。詳細: ${msg}`,
    }, { status: 400 });
  }

  const errors: string[] = [];
  let updatedUsers = 0;
  let failedUsers = 0;
  let updatedChannels = 0;
  let failedChannels = 0;

  // ── Refresh stale users ──
  const { data: staleUsers } = await db
    .schema("integrations")
    .from("external_users")
    .select("id, provider_user_id, display_name")
    .eq("connection_id", connection.id)
    .like("display_name", "user-%");

  for (const eu of staleUsers ?? []) {
    try {
      await delay(100); // rate-limit courtesy
      const info = await slack.getUserInfo(eu.provider_user_id);
      const realName = info.user.real_name || info.user.name;
      const avatarUrl = info.user.profile.image_72 ?? null;
      const email = info.user.profile.email ?? null;

      // Update external_users
      await db
        .schema("integrations")
        .from("external_users")
        .update({
          display_name: realName,
          avatar_url: avatarUrl,
          raw_profile: JSON.parse(JSON.stringify(info.user)),
        })
        .eq("id", eu.id);

      // Update linked people record
      const { data: link } = await db
        .from("identity_links")
        .select("person_id")
        .eq("provider", "slack")
        .eq("provider_user_id", eu.provider_user_id)
        .eq("provider_team_id", installation.provider_team_id)
        .single();

      if (link) {
        await db
          .from("people")
          .update({
            display_name: realName,
            ...(email ? { email } : {}),
          })
          .eq("id", link.person_id);

        // Update identity_links metadata
        await db
          .from("identity_links")
          .update({
            provider_metadata: {
              name: info.user.name,
              avatar: avatarUrl,
            },
          })
          .eq("person_id", link.person_id)
          .eq("provider", "slack")
          .eq("provider_user_id", eu.provider_user_id);
      }

      updatedUsers++;
    } catch (err) {
      failedUsers++;
      const msg = err instanceof Error ? err.message : String(err);
      if (errors.length < 10) {
        errors.push(`User ${eu.provider_user_id}: ${msg}`);
      }
    }
  }

  // ── Refresh stale channels ──
  const { data: staleChannels } = await db
    .schema("integrations")
    .from("external_channels")
    .select("id, provider_channel_id, channel_name")
    .eq("connection_id", connection.id);

  // Filter channels whose name looks like a raw ID (e.g. C04R5UB8HAB)
  const channelsToRefresh = (staleChannels ?? []).filter((ch) =>
    /^C[A-Z0-9]{8,}$/i.test(ch.channel_name),
  );

  for (const ch of channelsToRefresh) {
    try {
      await delay(100);
      const info = await slack.getChannelInfo(ch.provider_channel_id);
      if (info.channel.name) {
        await db
          .schema("integrations")
          .from("external_channels")
          .update({ channel_name: info.channel.name })
          .eq("id", ch.id);
        updatedChannels++;
      } else {
        // DMs/MPIMs may not have a useful name
        failedChannels++;
      }
    } catch (err) {
      failedChannels++;
      const msg = err instanceof Error ? err.message : String(err);
      if (errors.length < 10) {
        errors.push(`Channel ${ch.provider_channel_id}: ${msg}`);
      }
    }
  }

  return NextResponse.json({
    updatedUsers,
    updatedChannels,
    failedUsers,
    failedChannels,
    totalStaleUsers: staleUsers?.length ?? 0,
    totalStaleChannels: channelsToRefresh.length,
    errors,
    debug: {
      authTeamId: authInfo.team_id,
      authTeam: authInfo.team,
      dbTeamId: installation.provider_team_id,
      tokenPrefix: installation.bot_token?.substring(0, 15) + "...",
      staleUserIds: (staleUsers ?? []).map((u) => u.provider_user_id),
      staleChannelIds: channelsToRefresh.map((c) => c.provider_channel_id),
    },
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
