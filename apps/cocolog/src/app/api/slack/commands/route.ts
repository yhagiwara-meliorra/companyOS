import { NextResponse, after, type NextRequest } from "next/server";
import { verifySlackSignature } from "@/lib/slack/verify";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import {
  SlackSlashCommandSchema,
  type SlackSlashCommand,
} from "@/lib/validations/slack-command";
import { checkImproveRateLimit } from "@/lib/slack/rate-limit";
import { improveMessage } from "@/lib/anthropic/improve";
import { respondEphemeral } from "@/lib/slack/respond";
import { buildImproveResponseBlocks } from "@/lib/slack/improve-blocks";

export const runtime = "nodejs";

/**
 * Slack slash command handler.
 * Currently handles: /improve
 *
 * Flow: verify signature → parse payload → rate limit check →
 *       return 200 (acknowledgement) → async Claude call via after() →
 *       POST result to response_url
 */
export async function POST(request: NextRequest) {
  // 1. Read raw body (Slack sends application/x-www-form-urlencoded)
  const body = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  // 2. Verify Slack signature
  const signingSecret = serverEnv().SLACK_SIGNING_SECRET;
  if (!verifySlackSignature(signingSecret, timestamp, body, signature)) {
    console.error("[slack/commands] invalid signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // 3. Parse URL-encoded body into object, then validate with Zod
  const params = Object.fromEntries(new URLSearchParams(body));
  let command: SlackSlashCommand;
  try {
    command = SlackSlashCommandSchema.parse(params);
  } catch {
    console.error("[slack/commands] invalid payload");
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  // 4. Route by command name
  if (command.command === "/improve") {
    return handleImproveCommand(command);
  }

  return NextResponse.json({ error: "unknown command" }, { status: 400 });
}

async function handleImproveCommand(
  command: SlackSlashCommand,
): Promise<NextResponse> {
  // Validate that draft text is not empty
  if (!command.text.trim()) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "改善するテキストを入力してください。\n使い方: `/improve <下書きのメッセージ>`",
    });
  }

  // Look up installation to get org_id
  const db = createAdminClient();
  const { data: installation } = await db
    .schema("integrations")
    .from("installations")
    .select("connection_id")
    .eq("provider_team_id", command.team_id)
    .single();

  if (!installation) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Cocologがこのワークスペースにインストールされていません。",
    });
  }

  // Fetch connection to get org_id
  const { data: connection } = await db
    .schema("integrations")
    .from("connections")
    .select("id, org_id")
    .eq("id", installation.connection_id)
    .single();

  if (!connection) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "インストール情報の取得に失敗しました。",
    });
  }

  const orgId = connection.org_id;

  // Rate limit check
  const rateLimit = await checkImproveRateLimit(
    command.user_id,
    command.team_id,
    orgId,
  );

  if (!rateLimit.allowed) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: `利用制限に達しました（${rateLimit.limit}回/時間）。しばらくしてから再度お試しください。`,
    });
  }

  // Acknowledge immediately, then process asynchronously
  after(async () => {
    try {
      const { result } = await improveMessage(command.text, {
        orgId,
        providerUserId: command.user_id,
        providerTeamId: command.team_id,
      });

      const { text, blocks } = buildImproveResponseBlocks(result);
      await respondEphemeral(command.response_url, { text, blocks });
    } catch (err) {
      console.error("[/improve] processing failed:", err);
      await respondEphemeral(command.response_url, {
        text: "申し訳ございません。メッセージの改善処理中にエラーが発生しました。しばらくしてから再度お試しください。",
      }).catch((e) =>
        console.error("[/improve] error response failed:", e),
      );
    }
  });

  // Return immediate acknowledgement
  return NextResponse.json({
    response_type: "ephemeral",
    text: "メッセージを分析中です... 少々お待ちください",
  });
}
