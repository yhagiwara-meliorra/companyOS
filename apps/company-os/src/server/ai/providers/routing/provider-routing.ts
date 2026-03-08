import { z } from "zod";
import type { StructuredStepParams } from "../../../../graph/decision-workflow";
import { anthropicStructuredStep } from "../anthropic/anthropic-structured-step";
import { openaiStructuredStep } from "../openai/openai-structured-step";

function selectProvider(section: string): "anthropic" | "openai" {
  const anthropicSections = new Set(["constitution_check", "solution_frame", "build_direction"]);
  return anthropicSections.has(section) ? "anthropic" : "openai";
}

export async function providerRouting<TSchema extends z.ZodTypeAny>(
  params: StructuredStepParams<TSchema>,
): Promise<z.infer<TSchema>> {
  const selected = selectProvider(params.section);

  if (selected === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return anthropicStructuredStep(params);
  }
  if (selected === "openai" && process.env.OPENAI_API_KEY) {
    return openaiStructuredStep(params);
  }

  // Provider fallback if selected key is missing.
  if (process.env.ANTHROPIC_API_KEY) return anthropicStructuredStep(params);
  if (process.env.OPENAI_API_KEY) return openaiStructuredStep(params);

  throw new Error("No provider API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.");
}

