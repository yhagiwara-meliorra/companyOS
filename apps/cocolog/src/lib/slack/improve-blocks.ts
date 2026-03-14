/**
 * Build Slack Block Kit blocks for the /improve response.
 * Returned as an ephemeral message visible only to the invoking user.
 */
export function buildImproveResponseBlocks(result: {
  improved_text: string;
  tone_reason: string;
  alternatives: string[];
  scene_label: string;
}): { text: string; blocks: unknown[] } {
  // Fallback text for notifications / non-Block-Kit clients
  const text = `改善提案: ${result.improved_text}`;

  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "メッセージ改善提案",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*改善されたメッセージ:*\n>${result.improved_text}`,
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*トーン分析:*\n${result.tone_reason}`,
      },
    },
  ];

  if (result.alternatives.length > 0) {
    blocks.push({ type: "divider" });
    const altText = result.alternatives
      .map((alt, i) => `${i + 1}. ${alt}`)
      .join("\n");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*他の表現案:*\n${altText}`,
      },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `シーン: _${result.scene_label}_ | この提案はあなただけに表示されています`,
      },
    ],
  });

  return { text, blocks };
}
