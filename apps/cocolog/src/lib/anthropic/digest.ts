import { z } from "zod";
import { callJSON, ensureModelVersion } from "./client";
import {
  DIGEST_SYSTEM_PROMPT,
  DIGEST_VERSION,
  buildDigestUserMessage,
  type WeeklySignalInput,
} from "./prompts";

// ── Schema ───────────────────────────────────────────────────────────────────

const DigestResultSchema = z.object({
  markdown: z.string().min(1),
  highlights: z.array(z.object({ text: z.string() })),
});

export type DigestResult = z.infer<typeof DigestResultSchema>;

// ── Main digest function ─────────────────────────────────────────────────────

/**
 * Generate a weekly coaching digest for a person.
 * Returns Markdown report + highlights, along with the model_version_id used.
 */
export async function generateDigest(
  personName: string,
  weekStart: string,
  signals: WeeklySignalInput[],
  totalMessages: number,
): Promise<{ digest: DigestResult; modelVersionId: string; latencyMs: number }> {
  const modelVersionId = await ensureModelVersion(
    DIGEST_SYSTEM_PROMPT,
    `${DIGEST_VERSION}: weekly coaching digest prompt`,
  );

  const userMessage = buildDigestUserMessage(
    personName,
    weekStart,
    signals,
    totalMessages,
  );

  const { result: raw, latencyMs } = await callJSON<DigestResult>(
    DIGEST_SYSTEM_PROMPT,
    userMessage,
    { maxTokens: 2048 },
  );

  const digest = DigestResultSchema.parse(raw);

  return { digest, modelVersionId, latencyMs };
}
