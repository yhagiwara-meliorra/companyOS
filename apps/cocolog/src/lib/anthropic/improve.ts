import crypto from "crypto";
import { callJSON, ensureModelVersion } from "./client";
import {
  IMPROVE_SYSTEM_PROMPT,
  IMPROVE_VERSION,
  buildImproveUserMessage,
  ImproveResultSchema,
  type ImproveResult,
} from "./prompts/improve-message";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ImproveAndPersistResult {
  result: ImproveResult;
  requestId: string;
  latencyMs: number;
}

/**
 * Improve a draft message and persist metadata (NOT the raw draft text).
 *
 * The draft text is passed transiently for AI processing only.
 * Only the content_hash and model outputs are persisted.
 */
export async function improveMessage(
  draftText: string,
  context: {
    orgId: string;
    providerUserId: string;
    providerTeamId: string;
  },
): Promise<ImproveAndPersistResult> {
  const db = createAdminClient();

  // Ensure model version exists for this prompt
  const modelVersionId = await ensureModelVersion(
    IMPROVE_SYSTEM_PROMPT,
    `${IMPROVE_VERSION}: message improvement prompt`,
  );

  // Call Claude API (draft text is transient — never persisted)
  const userMessage = buildImproveUserMessage(draftText);
  const { result: raw, latencyMs } = await callJSON<ImproveResult>(
    IMPROVE_SYSTEM_PROMPT,
    userMessage,
    { maxTokens: 1024 },
  );

  // Validate response against schema
  const result = ImproveResultSchema.parse(raw);

  // Hash draft text for dedup analysis (never store raw text)
  const contentHash = crypto
    .createHash("sha256")
    .update(draftText)
    .digest("hex");

  // Persist request metadata + model outputs only
  const { data: request } = await db
    .schema("ai")
    .from("improvement_requests")
    .insert({
      org_id: context.orgId,
      provider_user_id: context.providerUserId,
      provider_team_id: context.providerTeamId,
      content_hash: contentHash,
      model_version_id: modelVersionId,
      scene_label: result.scene_label,
      improved_text: result.improved_text,
      tone_reason: result.tone_reason,
      alternatives: result.alternatives,
      latency_ms: latencyMs,
    })
    .select("id")
    .single();

  if (!request) throw new Error("Failed to insert improvement_request");

  return { result, requestId: request.id, latencyMs };
}
