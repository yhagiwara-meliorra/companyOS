import { z } from "zod";
import { callJSON, ensureModelVersion } from "./client";
import {
  CLASSIFY_SYSTEM_PROMPT,
  CLASSIFY_VERSION,
  buildClassifyUserMessage,
} from "./prompts";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Zod schemas ──────────────────────────────────────────────────────────────

const SceneLabelSchema = z.enum([
  "question",
  "answer",
  "feedback",
  "request",
  "announcement",
  "discussion",
  "greeting",
  "gratitude",
  "apology",
  "casual",
  "status_update",
  "decision",
  "other",
]);

const SignalScoreSchema = z.object({
  value: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});

const ClassificationResultSchema = z.object({
  scene_label: SceneLabelSchema,
  confidence: z.number().min(0).max(1),
  tone_score: z.number().min(0).max(1),
  politeness_score: z.number().min(0).max(1),
  flags: z.array(z.string()),
  signals: z.record(z.string(), SignalScoreSchema),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

// ── Signal definitions loader ────────────────────────────────────────────────

interface SignalDef {
  key: string;
  label: string;
  description: string;
}

interface TaxonomyResult {
  id: string;
  signalDefs: SignalDef[];
}

export async function getActiveTaxonomy(): Promise<TaxonomyResult> {
  const db = createAdminClient();
  const { data } = await db
    .schema("ai")
    .from("taxonomy_versions")
    .select("id, signal_definitions")
    .eq("is_active", true)
    .single();

  if (!data) throw new Error("No active taxonomy version");

  const defs = data.signal_definitions as Record<
    string,
    { label: string; description: string }
  >;

  return {
    id: data.id,
    signalDefs: Object.entries(defs).map(([key, def]) => ({
      key,
      label: def.label,
      description: def.description,
    })),
  };
}

// ── Main classification function ─────────────────────────────────────────────

export interface ClassifyAndPersistResult {
  classification: ClassificationResult;
  analysisId: string;
  latencyMs: number;
}

/**
 * Classify a message and persist the result to ai.message_analyses.
 *
 * The message text is passed transiently for analysis only.
 * It is NEVER stored in the database — only the resulting scores.
 */
export async function classifyMessage(
  messageText: string,
  messageRefId: string,
): Promise<ClassifyAndPersistResult> {
  const db = createAdminClient();

  // Load taxonomy + ensure model version
  const taxonomy = await getActiveTaxonomy();
  const modelVersionId = await ensureModelVersion(
    CLASSIFY_SYSTEM_PROMPT,
    `${CLASSIFY_VERSION}: message classification prompt`,
  );

  // Build prompt and call Claude
  const userMessage = buildClassifyUserMessage(messageText, taxonomy.signalDefs);
  const { result: raw, latencyMs } = await callJSON<ClassificationResult>(
    CLASSIFY_SYSTEM_PROMPT,
    userMessage,
  );

  // Validate
  const classification = ClassificationResultSchema.parse(raw);

  // Persist to ai.message_analyses
  const { data: analysis } = await db
    .schema("ai")
    .from("message_analyses")
    .insert({
      message_ref_id: messageRefId,
      model_version_id: modelVersionId,
      taxonomy_version_id: taxonomy.id,
      scores: JSON.parse(JSON.stringify(classification)),
      latency_ms: latencyMs,
    })
    .select("id")
    .single();

  if (!analysis) throw new Error("Failed to insert message_analysis");

  return {
    classification,
    analysisId: analysis.id,
    latencyMs,
  };
}
