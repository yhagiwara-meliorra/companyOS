import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { SlackClient } from "@/lib/slack/client";
import { classifyMessage } from "@/lib/anthropic/classify";
import type { SlackMessageEvent } from "@/lib/validations/slack";

interface EventContext {
  teamId: string;
  eventId: string;
  webhookEventId: string;
}

/**
 * Async post-processing for a Slack message event.
 * Called via next/server `after()` so the 200 response is already sent.
 */
export async function processMessageEvent(
  event: SlackMessageEvent,
  ctx: EventContext,
): Promise<void> {
  const db = createAdminClient();

  try {
    // Mark as processing
    await db
      .schema("integrations")
      .from("webhook_events")
      .update({ status: "processing" })
      .eq("id", ctx.webhookEventId);

    // Look up installation + connection
    const { data: installation } = await db
      .schema("integrations")
      .from("installations")
      .select(
        "id, connection_id, bot_token, provider_team_id, connections(id, org_id)",
      )
      .eq("provider_team_id", ctx.teamId)
      .single();

    if (!installation) {
      await updateStatus(db, ctx.webhookEventId, "skipped", "no installation found");
      return;
    }

    const connection = installation.connections as unknown as {
      id: string;
      org_id: string;
    };
    const connectionId = connection.id;
    const orgId = connection.org_id;
    const slack = new SlackClient(installation.bot_token);

    // Fetch user info (non-fatal — continue with fallback if user_not_found)
    let userInfo: {
      user: {
        id: string;
        name: string;
        real_name: string;
        profile: { email?: string; image_72?: string };
      };
    } | null = null;
    try {
      userInfo = await slack.getUserInfo(event.user);
    } catch (userErr) {
      const errMsg = userErr instanceof Error ? userErr.message : String(userErr);
      console.warn("[event-processor] users.info failed (non-fatal):", {
        user: event.user,
        teamId: ctx.teamId,
        error: errMsg,
      });
      // user_not_found: external user, deactivated, or Slack Connect guest
      // Continue processing with fallback name — message still gets classified.
    }

    // Check org-level analysis scope setting
    const { data: orgRow } = await db
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();

    // Default to "members_only" — owner is included in memberships (no role filter).
    const analysisScope =
      (orgRow?.settings as Record<string, unknown> | null)?.analysis_scope ?? "members_only";

    if (analysisScope === "members_only") {
      // Only analyze messages from Slack users whose email matches an org member.
      const slackEmail = userInfo?.user.profile.email?.toLowerCase();
      if (!slackEmail) {
        // No email available — either users.info failed or user has no email.
        // In members_only mode, skip if we can't verify membership.
        await updateStatus(
          db,
          ctx.webhookEventId,
          "skipped",
          userInfo
            ? "no email for sender (members_only mode)"
            : "users.info failed, cannot verify membership (members_only mode)",
        );
        return;
      }

      const { data: members } = await db
        .from("memberships")
        .select("profile_id")
        .eq("org_id", orgId);

      let isMember = false;
      for (const m of members ?? []) {
        const { data: authData } = await db.auth.admin.getUserById(m.profile_id);
        if (authData?.user?.email?.toLowerCase() === slackEmail) {
          isMember = true;
          break;
        }
      }

      if (!isMember) {
        await updateStatus(db, ctx.webhookEventId, "skipped", "sender not an org member (members_only mode)");
        return;
      }
    }

    // Fallback display name when users.info failed
    const displayName = userInfo
      ? userInfo.user.real_name || userInfo.user.name
      : `user-${event.user}`;
    const avatarUrl = userInfo?.user.profile.image_72 ?? null;

    const { data: extUser } = await db
      .schema("integrations")
      .from("external_users")
      .upsert(
        {
          connection_id: connectionId,
          provider_user_id: event.user,
          display_name: displayName,
          avatar_url: avatarUrl,
          raw_profile: userInfo
            ? JSON.parse(JSON.stringify(userInfo.user))
            : { id: event.user, fallback: true },
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "connection_id,provider_user_id" },
      )
      .select("id")
      .single();

    // Resolve channel name via Slack API (non-fatal)
    let channelName = event.channel; // fallback to channel ID
    try {
      const channelInfo = await slack.getChannelInfo(event.channel);
      channelName = channelInfo.channel.name;
    } catch (chanErr) {
      const errMsg = chanErr instanceof Error ? chanErr.message : String(chanErr);
      console.warn("[event-processor] conversations.info failed (non-fatal):", {
        channel: event.channel,
        error: errMsg,
      });
      // DMs / MPIMs may not have a name — fallback to channel ID is fine.
    }

    // Upsert external_channel
    const { data: extChannel } = await db
      .schema("integrations")
      .from("external_channels")
      .upsert(
        {
          connection_id: connectionId,
          provider_channel_id: event.channel,
          channel_name: channelName,
          channel_type: event.channel_type ?? "channel",
        },
        { onConflict: "connection_id,provider_channel_id" },
      )
      .select("id")
      .single();

    // Resolve person via identity_links
    const { data: identityLink } = await db
      .from("identity_links")
      .select("person_id")
      .eq("provider", "slack")
      .eq("provider_user_id", event.user)
      .eq("provider_team_id", ctx.teamId)
      .single();

    let personId: string | null = null;
    if (identityLink) {
      personId = identityLink.person_id;
    } else {
      // Auto-create person + identity_link
      const { data: person } = await db
        .from("people")
        .insert({
          org_id: orgId,
          display_name: displayName,
          email: userInfo?.user.profile.email ?? null,
        })
        .select("id")
        .single();

      if (person) {
        personId = person.id;
        await db.from("identity_links").insert({
          person_id: personId,
          provider: "slack",
          provider_user_id: event.user,
          provider_team_id: ctx.teamId,
          provider_metadata: {
            name: userInfo?.user.name ?? event.user,
            avatar: userInfo?.user.profile.image_72 ?? null,
          },
        });
      }
    }

    // Get permalink (best effort)
    let permalink: string | null = null;
    try {
      permalink = await slack.getPermalink(event.channel, event.ts);
    } catch {
      // not critical
    }

    // Hash content (NEVER store raw text)
    const contentHash = crypto
      .createHash("sha256")
      .update(event.text)
      .digest("hex");

    // Insert message_ref
    const { data: messageRef } = await db
      .schema("integrations")
      .from("message_refs")
      .upsert(
        {
          org_id: orgId,
          person_id: personId,
          connection_id: connectionId,
          provider_message_id: event.ts,
          provider_channel_id: event.channel,
          channel_ref_id: extChannel?.id ?? null,
          sender_ref_id: extUser?.id ?? null,
          sent_at: new Date(parseFloat(event.ts) * 1000).toISOString(),
          permalink,
          content_hash: contentHash,
          metadata: { channel_type: event.channel_type },
        },
        { onConflict: "connection_id,provider_message_id" },
      )
      .select("id")
      .single();

    // Classify the message (text is transient — never stored)
    if (messageRef) {
      try {
        await classifyMessage(event.text, messageRef.id);
      } catch (classifyErr) {
        // Classification failure is non-fatal — message_ref is already saved.
        // The analyze-pending cron can retry later.
        console.error("Classification failed (non-fatal):", classifyErr);
      }
    }

    // Mark as processed
    await updateStatus(db, ctx.webhookEventId, "processed");
  } catch (err) {
    await updateStatus(
      db,
      ctx.webhookEventId,
      "failed",
      err instanceof Error ? err.message : "unknown error",
    );
  }
}

async function updateStatus(
  db: ReturnType<typeof createAdminClient>,
  id: string,
  status: "processing" | "processed" | "failed" | "skipped",
  errorMessage?: string,
) {
  await db
    .schema("integrations")
    .from("webhook_events")
    .update({
      status,
      ...(status === "processed" || status === "skipped"
        ? { processed_at: new Date().toISOString() }
        : {}),
      ...(errorMessage ? { error_message: errorMessage } : {}),
    })
    .eq("id", id);
}
