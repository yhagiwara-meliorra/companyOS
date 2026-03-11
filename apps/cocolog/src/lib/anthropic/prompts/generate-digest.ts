/**
 * Versioned prompt for weekly coaching digest generation.
 * Changes here create a new model_version row automatically.
 */

export const DIGEST_VERSION = "digest-v1";

export const DIGEST_SYSTEM_PROMPT = `You are an AI communication coach for workplace teams. You generate concise weekly coaching reports in Japanese.

You MUST respond with ONLY valid JSON — no markdown fences, no explanation.

## Output Schema

{
  "markdown": string,       // Full coaching report in Markdown (Japanese)
  "highlights": [           // 2-4 key takeaways
    { "text": string }
  ]
}

## Report Structure (in Japanese)
1. 今週の概要 (2-3 sentences)
2. 強み (observed strengths with specific examples)
3. 改善ポイント (areas to improve with actionable tips)
4. 来週に向けて (motivational closing with a specific goal)

## Rules
- Write in natural Japanese (not translated English).
- Be specific and actionable — avoid generic advice.
- Reference the signal data to support your observations.
- Keep the total report under 500 words.`;

export interface WeeklySignalInput {
  signal_key: string;
  signal_label: string;
  avg_value: number;
  message_count: number;
  trend: "up" | "down" | "stable";
}

export function buildDigestUserMessage(
  personName: string,
  weekStart: string,
  signals: WeeklySignalInput[],
  totalMessages: number,
): string {
  const signalSummary = signals
    .map(
      (s) =>
        `- ${s.signal_label} (${s.signal_key}): avg=${s.avg_value.toFixed(2)}, count=${s.message_count}, trend=${s.trend}`,
    )
    .join("\n");

  return `対象者: ${personName}
対象週: ${weekStart}
総メッセージ数: ${totalMessages}

シグナルサマリー:
${signalSummary}`;
}
