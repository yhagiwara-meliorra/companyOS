import { NextResponse, after, type NextRequest } from "next/server";
import crypto from "crypto";
import { verifySlackSignature } from "@/lib/slack/verify";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { SlackEventPayloadSchema } from "@/lib/validations/slack";
import { checkIdempotency } from "@/lib/slack/idempotency";
import { processMessageEvent } from "@/lib/slack/event-processor";

export const runtime = "nodejs";

/**
 * Slack Events API webhook handler.
 * Flow: verify signature → url_verification → idempotency check →
 *       insert webhook_events (pending) → return 200 → async processing via after()
 */
export async function POST(request: NextRequest) {
  // 1. Read raw body
  const body = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  // 2. Verify signature
  const signingSecret = serverEnv().SLACK_SIGNING_SECRET;
  if (!verifySlackSignature(signingSecret, timestamp, body, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // 3. Parse and validate payload
  let payload;
  try {
    payload = SlackEventPayloadSchema.parse(JSON.parse(body));
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  // 4. Handle url_verification
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // 5. Process event_callback
  if (payload.type === "event_callback") {
    const event = payload.event;
    const providerEventId =
      payload.event_id ?? `${payload.team_id}:${event.ts}`;

    // 6. Idempotency check
    const isDuplicate = await checkIdempotency(providerEventId);
    if (isDuplicate) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // 7. Only process new human messages
    if (
      event.type === "message" &&
      !event.subtype &&
      !event.bot_id &&
      event.text
    ) {
      const db = createAdminClient();

      // Find connection for this team
      const { data: installation } = await db
        .schema("integrations")
        .from("installations")
        .select("connection_id")
        .eq("provider_team_id", payload.team_id)
        .single();

      if (installation) {
        // Compute payload hash (for dedup, not storing raw text)
        const payloadHash = crypto
          .createHash("sha256")
          .update(body)
          .digest("hex");

        // 8. Insert webhook_event as pending
        const { data: webhookEvent } = await db
          .schema("integrations")
          .from("webhook_events")
          .insert({
            connection_id: installation.connection_id,
            provider_event_id: providerEventId,
            event_type: `message.${event.channel_type ?? "channel"}`,
            status: "pending",
            payload_hash: payloadHash,
            payload: {
              // Store only metadata, NEVER raw text
              user_id: event.user,
              channel_id: event.channel,
              channel_type: event.channel_type,
              message_ts: event.ts,
              has_text: !!event.text,
              text_length: event.text.length,
            },
            received_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        // 9. Return 200 immediately, then process async via after()
        if (webhookEvent) {
          after(async () => {
            await processMessageEvent(event, {
              teamId: payload.team_id,
              eventId: providerEventId,
              webhookEventId: webhookEvent.id,
            });
          });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
