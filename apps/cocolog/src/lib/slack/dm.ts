import { createSlackWebClient } from "./client";

/**
 * Send a DM to a Slack user via the bot.
 * Uses conversations.open + chat.postMessage.
 */
export async function sendSlackDM(
  botToken: string,
  slackUserId: string,
  text: string,
  opts?: { blocks?: unknown[] },
): Promise<{ ok: boolean; ts?: string; channel?: string }> {
  const client = createSlackWebClient(botToken);

  // Open a DM channel with the user
  const openResult = await client.conversations.open({ users: slackUserId });
  if (!openResult.ok || !openResult.channel?.id) {
    throw new Error(`Failed to open DM: ${openResult.error ?? "unknown"}`);
  }

  const channelId = openResult.channel.id;

  // Send the message
  const postResult = await client.chat.postMessage({
    channel: channelId,
    text,
    ...(opts?.blocks ? { blocks: opts.blocks } : {}),
  });

  return {
    ok: postResult.ok ?? false,
    ts: postResult.ts,
    channel: channelId,
  };
}

/**
 * Build a Slack DM payload for a weekly digest.
 * Returns blocks for rich formatting.
 */
export function buildDigestDMPayload(
  personName: string,
  weekStart: string,
  digestMarkdown: string,
  dashboardUrl: string,
): { text: string; blocks: unknown[] } {
  // Slack mrkdwn summary (plain text fallback)
  const text = `${personName}さんの週次コーチングダイジェスト (${weekStart})`;

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${personName}さんの週次コーチングダイジェスト`,
        emoji: true,
      },
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: `対象週: *${weekStart}*` },
      ],
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: truncateForSlack(digestMarkdown, 2900),
      },
    },
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "ダッシュボードで確認" },
          url: dashboardUrl,
          action_id: "open_dashboard",
        },
      ],
    },
  ];

  return { text, blocks };
}

/** Truncate text to fit Slack's 3000-char limit per section. */
function truncateForSlack(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}
