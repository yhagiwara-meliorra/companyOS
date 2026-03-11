import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyMessage } from "@/lib/anthropic/classify";
import { createSlackWebClient } from "@/lib/slack/client";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 10;

/**
 * Retry failed/pending signal-analysis events.
 *
 * 1. Find webhook_events with status='failed' and attempts < MAX_ATTEMPTS
 * 2. Find message_refs without matching message_analyses
 * 3. Re-fetch message text from Slack and classify
 *
 * Protected by CRON_SECRET bearer token.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  let retriedEvents = 0;
  let retriedAnalyses = 0;
  let failed = 0;

  // ── Part 1: Retry failed webhook_events ──────────────────────────────────

  const { data: failedEvents } = await db
    .schema("integrations")
    .from("webhook_events")
    .select("id, connection_id, payload, attempts")
    .eq("status", "failed")
    .lt("attempts", MAX_ATTEMPTS)
    .order("received_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (failedEvents && failedEvents.length > 0) {
    for (const event of failedEvents) {
      try {
        // Increment attempts
        await db
          .schema("integrations")
          .from("webhook_events")
          .update({
            status: "processing",
            attempts: (event.attempts ?? 0) + 1,
          })
          .eq("id", event.id);

        const payload = event.payload as {
          user_id?: string;
          channel_id?: string;
          message_ts?: string;
        } | null;

        if (!payload?.channel_id || !payload?.message_ts) {
          await db
            .schema("integrations")
            .from("webhook_events")
            .update({
              status: "skipped",
              error_message: "missing payload data for retry",
              processed_at: new Date().toISOString(),
            })
            .eq("id", event.id);
          continue;
        }

        // Get bot token
        const { data: installation } = await db
          .schema("integrations")
          .from("installations")
          .select("bot_token")
          .eq("connection_id", event.connection_id)
          .single();

        if (!installation) {
          await db
            .schema("integrations")
            .from("webhook_events")
            .update({
              status: "skipped",
              error_message: "no installation for retry",
              processed_at: new Date().toISOString(),
            })
            .eq("id", event.id);
          continue;
        }

        // Re-fetch message
        const slack = createSlackWebClient(installation.bot_token);
        const history = await slack.conversations.history({
          channel: payload.channel_id,
          latest: payload.message_ts,
          inclusive: true,
          limit: 1,
        });

        const message = history.messages?.[0];
        if (!message?.text) {
          await db
            .schema("integrations")
            .from("webhook_events")
            .update({
              status: "skipped",
              error_message: "message text no longer available",
              processed_at: new Date().toISOString(),
            })
            .eq("id", event.id);
          continue;
        }

        // Find the message_ref for this event
        const { data: ref } = await db
          .schema("integrations")
          .from("message_refs")
          .select("id")
          .eq("connection_id", event.connection_id)
          .eq("provider_message_id", payload.message_ts)
          .single();

        if (ref) {
          // Check if already analyzed
          const { data: existing } = await db
            .schema("ai")
            .from("message_analyses")
            .select("id")
            .eq("message_ref_id", ref.id)
            .limit(1)
            .single();

          if (!existing) {
            await classifyMessage(message.text, ref.id);
          }
        }

        await db
          .schema("integrations")
          .from("webhook_events")
          .update({
            status: "processed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", event.id);

        retriedEvents++;
      } catch (err) {
        await db
          .schema("integrations")
          .from("webhook_events")
          .update({
            status: "failed",
            error_message: err instanceof Error ? err.message : String(err),
          })
          .eq("id", event.id);
        failed++;
      }
    }
  }

  // ── Part 2: Retry unanalyzed message_refs ────────────────────────────────

  const { data: recentRefs } = await db
    .schema("integrations")
    .from("message_refs")
    .select("id, connection_id, provider_message_id, provider_channel_id")
    .not("content_hash", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (recentRefs && recentRefs.length > 0) {
    const refIds = recentRefs.map((r) => r.id);
    const { data: analyzed } = await db
      .schema("ai")
      .from("message_analyses")
      .select("message_ref_id")
      .in("message_ref_id", refIds);

    const analyzedSet = new Set((analyzed ?? []).map((a) => a.message_ref_id));
    const unanalyzed = recentRefs
      .filter((r) => !analyzedSet.has(r.id))
      .slice(0, BATCH_SIZE);

    for (const ref of unanalyzed) {
      try {
        const { data: installation } = await db
          .schema("integrations")
          .from("installations")
          .select("bot_token")
          .eq("connection_id", ref.connection_id)
          .single();

        if (!installation) continue;

        const slack = createSlackWebClient(installation.bot_token);
        const history = await slack.conversations.history({
          channel: ref.provider_channel_id,
          latest: ref.provider_message_id,
          inclusive: true,
          limit: 1,
        });

        const message = history.messages?.[0];
        if (!message?.text) continue;

        await classifyMessage(message.text, ref.id);
        retriedAnalyses++;
      } catch (err) {
        console.error(`Retry analysis failed for ref ${ref.id}:`, err);
        failed++;
      }
    }
  }

  return NextResponse.json({
    message: "retry-pending-events complete",
    retriedEvents,
    retriedAnalyses,
    failed,
  });
}
