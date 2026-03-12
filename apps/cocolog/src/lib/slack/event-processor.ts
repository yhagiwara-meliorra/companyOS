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

    // Upsert external_user
    let userInfo;
    try {
      userInfo = await slack.getUserInfo(event.user);
    } catch (userErr) {
      const errMsg = userErr instanceof Error ? userErr.message : String(userErr);
      console.error("[event-processor] failed to fetch user info:", {
        user: event.user,
        teamId: ctx.teamId,
        error: errMsg,
        botTokenLength: installation.bot_token?.length ?? 0,
      });
      await updateStatus(db, ctx.webhookEventId, "failed", `failed to fetch user info: ${errMsg}`);
      return;
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
      // Approach: get all member profile_ids → look up each auth user → compare emails.
      const slackEmail = userInfo.user.profile.email?.toLowerCase();
      if (!slackEmail) {
        await updateStatus(db, ctx.webhookEventId, "skipped", "no email for sender (members_only mode)");
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

    const { data: extUser } = await db
      .schema("integrations")
      .from("external_users")
      .upsert(
        {
          connection_id: connectionId,
          provider_user_id: event.user,
          display_name: userInfo.user.real_name || userInfo.user.name,
          avatar_url: userInfo.user.profile.image_72 ?? null,
          raw_profile: JSON.parse(JSON.stringify(userInfo.user)),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "connection_id,provider_user_id" },
      )
      .select("id")
      .single();

    // Upsert external_channel
    const { data: extChannel } = await db
      .schema("integrations")
      .from("external_channels")
      .upsert(
        {
          connection_id: connectionId,
          provider_channel_id: event.channel,
          channel_name: event.channel,
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
          display_name: userInfo.user.real_name || userInfo.user.name,
          email: userInfo.user.profile.email ?? null,
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
            name: userInfo.user.name,
            avatar: userInfo.user.profile.image_72,
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
