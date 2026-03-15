/**
 * Post an ephemeral response via Slack response_url.
 * Works for both slash commands and interactivity payloads (message shortcuts, etc.).
 * The response_url is valid for 30 minutes after the interaction.
 */
export async function respondEphemeral(
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
