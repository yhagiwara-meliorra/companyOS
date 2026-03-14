/**
 * Post an ephemeral response to a Slack slash command via response_url.
 * The response_url is valid for 30 minutes after the command is invoked.
 */
export async function respondToSlashCommand(
  responseUrl: string,
  payload: {
    text: string;
    blocks?: unknown[];
    response_type?: "ephemeral" | "in_channel";
    replace_original?: boolean;
  },
): Promise<void> {
  const body: Record<string, unknown> = {
    response_type: payload.response_type ?? "ephemeral",
    text: payload.text,
  };

  if (payload.blocks) {
    body.blocks = payload.blocks;
  }

  if (payload.replace_original !== undefined) {
    body.replace_original = payload.replace_original;
  }

  const res = await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(
      `response_url POST failed: ${res.status} ${res.statusText}`,
    );
  }
}
