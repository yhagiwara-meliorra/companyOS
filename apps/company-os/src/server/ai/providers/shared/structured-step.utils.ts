import { z } from "zod";
import type { StructuredStepParams } from "../../../../graph/decision-workflow";

function stripCodeFence(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function parseJsonFromModelText(text: string) {
  const cleaned = stripCodeFence(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Model output is not valid JSON.");
  }
}

export function renderStructuredPrompt<TSchema extends z.ZodTypeAny>(
  params: StructuredStepParams<TSchema>,
) {
  return [
    params.system,
    "",
    "Output contract:",
    "- Return ONLY one JSON object.",
    "- Do not include markdown fences.",
    "- Keys must match requested shape.",
    "",
    "Section:",
    params.section,
    "",
    "User input:",
    params.user,
  ].join("\n");
}

