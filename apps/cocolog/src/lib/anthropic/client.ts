import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const MODEL = "claude-sonnet-4-20250514";

let _client: Anthropic | null = null;

/** Lazy singleton Anthropic SDK client. */
export function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic();
  }
  return _client;
}

export function getModelName(): string {
  return MODEL;
}

/** Compute SHA-256 hash of a prompt template for versioning. */
export function hashPrompt(template: string): string {
  return crypto.createHash("sha256").update(template).digest("hex");
}

/**
 * Ensure a model_version row exists for the given model + prompt hash.
 * Returns the model_version ID.
 */
export async function ensureModelVersion(
  promptTemplate: string,
  description: string,
): Promise<string> {
  const db = createAdminClient();
  const promptHash = hashPrompt(promptTemplate);

  // Try to find existing
  const { data: existing } = await db
    .schema("ai")
    .from("model_versions")
    .select("id")
    .eq("model_name", MODEL)
    .eq("prompt_hash", promptHash)
    .single();

  if (existing) return existing.id;

  // Insert new version
  const { data: created } = await db
    .schema("ai")
    .from("model_versions")
    .insert({
      model_name: MODEL,
      prompt_hash: promptHash,
      prompt_template: promptTemplate,
      description,
      is_active: true,
    })
    .select("id")
    .single();

  if (!created) throw new Error("Failed to create model_version");
  return created.id;
}

/**
 * Call Claude Messages API and parse a JSON response.
 * Throws on non-text response or JSON parse failure.
 */
export async function callJSON<T>(
  systemPrompt: string,
  userMessage: string,
  opts?: { maxTokens?: number },
): Promise<{ result: T; latencyMs: number }> {
  const client = getClient();
  const start = Date.now();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: opts?.maxTokens ?? 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const latencyMs = Date.now() - start;

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  // Extract JSON from potential markdown fences
  let jsonStr = textBlock.text.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  const result = JSON.parse(jsonStr) as T;
  return { result, latencyMs };
}
