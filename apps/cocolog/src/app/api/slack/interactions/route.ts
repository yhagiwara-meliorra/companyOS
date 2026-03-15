import { NextResponse, after, type NextRequest } from "next/server";
import { verifySlackSignature } from "@/lib/slack/verify";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import {
  SlackInteractionPayloadSchema,
  type SlackMessageAction,
} from "@/lib/validations/slack-interaction";
import { checkImproveRateLimit } from "@/lib/slack/rate-limit";
import { improveMessage } from "@/lib/anthropic/improve";
import { respondEphemeral } from "@/lib/slack/respond";
import { buildImproveShortcutBlocks } from "@/lib/slack/improve-blocks";

export const runtime = "nodejs";

/**
 * Slack interactivity handler.
 * Receives all interactive payloads (message_action, block_actions, view_submission).
 * Currently handles: message_action with callback_id "improve_message"
 *
 * Flow: verify signature → parse payload JSON from form body →
 *       route by type/callback_id → return 200 (acknowledgement) →
 *       async processing via after()
 */
export async function POST(request: NextRequest) {
  // 1. Read raw body (application/x-www-form-urlencoded with "payload" field)
  const body = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  // 2. Verify Slack signature (over the raw body, same as commands/events)
  const signingSecret = serverEnv().SLACK_SIGNING_SECRET;
  if (!verifySlackSignature(signingSecret, timestamp, body, signature)) {
    console.error("[slack/interactions] invalid signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // 3. Extract the "payload" field from URL-encoded body, parse as JSON
  const params = new URLSearchParams(body);
  const payloadStr = params.get("payload");
  if (!payloadStr) {
    console.error("[slack/interactions] missing payload field");
    return NextResponse.json({ error: "missing payload" }, { status: 400 });
  }

  let payload;
  try {
    payload = SlackInteractionPayloadSchema.parse(JSON.parse(payloadStr));
  } catch (err) {
    console.error(
      "[slack/interactions] invalid payload:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  // 4. Route by type
  if (payload.type === "message_action") {
    return handleMessageAction(payload);
  }

  // Unknown interaction type — acknowledge silently
  return new NextResponse(null, { status: 200 });
}

async function handleMessageAction(
  action: SlackMessageAction,
): Promise<NextResponse> {
  // Route by callback_id
  if (action.callback_id === "improve_message") {
    return handleImproveShortcut(action);
  }

  // Unknown callback_id — acknowledge silently
  console.warn(
    "[slack/interactions] unknown callback_id:",
    action.callback_id,
  );
  return new NextResponse(null, { status: 200 });
}

async function handleImproveShortcut(
  action: SlackMessageAction,
): Promise<NextResponse> {
  const messageText = action.message.text;

  // Guard: empty message text (e.g. image-only messages)
  if (!messageText.trim()) {
    // For interactions, we respond via response_url rather than the 200 body
    after(async () => {
      await respondEphemeral(action.response_url, {
        text: "このメッセージにはテキストが含まれていません。",
      }).catch((e) =>
        console.error("[improve-shortcut] empty text response failed:", e),
      );
    });
    return new NextResponse(null, { status: 200 });
  }

  // Look up installation → connection → org_id
  const db = createAdminClient();
  const { data: installation } = await db
    .schema("integrations")
    .from("installations")
    .select("connection_id")
    .eq("provider_team_id", action.team.id)
    .single();

  if (!installation) {
    after(async () => {
      await respondEphemeral(action.response_url, {
        text: "Cocologがこのワークスペースにインストールされていません。",
      }).catch((e) =>
        console.error("[improve-shortcut] no-install response failed:", e),
      );
    });
    return new NextResponse(null, { status: 200 });
  }

  const { data: connection } = await db
    .schema("integrations")
    .from("connections")
    .select("id, org_id")
    .eq("id", installation.connection_id)
    .single();

  if (!connection) {
    after(async () => {
      await respondEphemeral(action.response_url, {
        text: "インストール情報の取得に失敗しました。",
      }).catch((e) =>
        console.error("[improve-shortcut] no-connection response failed:", e),
      );
    });
    return new NextResponse(null, { status: 200 });
  }

  const orgId = connection.org_id;

  // Rate limit check (same limits as /improve command)
  const rateLimit = await checkImproveRateLimit(
    action.user.id,
    action.team.id,
    orgId,
  );

  if (!rateLimit.allowed) {
    after(async () => {
      await respondEphemeral(action.response_url, {
        text: `利用制限に達しました（${rateLimit.limit}回/時間）。しばらくしてから再度お試しください。`,
      }).catch((e) =>
        console.error("[improve-shortcut] rate-limit response failed:", e),
      );
    });
    return new NextResponse(null, { status: 200 });
  }

  // Acknowledge immediately, then process asynchronously
  after(async () => {
    try {
      // Send "processing" indicator first
      await respondEphemeral(action.response_url, {
        text: "メッセージを分析中です... 少々お待ちください",
      });

      const { result } = await improveMessage(messageText, {
        orgId,
        providerUserId: action.user.id,
        providerTeamId: action.team.id,
      });

      const { text, blocks } = buildImproveShortcutBlocks(messageText, result);
      await respondEphemeral(action.response_url, { text, blocks });
    } catch (err) {
      console.error("[improve-shortcut] processing failed:", err);
      await respondEphemeral(action.response_url, {
        text: "申し訳ございません。メッセージの改善処理中にエラーが発生しました。しばらくしてから再度お試しください。",
      }).catch((e) =>
        console.error("[improve-shortcut] error response failed:", e),
      );
    }
  });

  // Return empty 200 to acknowledge (Slack requires this within 3 seconds)
  return new NextResponse(null, { status: 200 });
}
