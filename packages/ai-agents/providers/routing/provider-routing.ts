import { z } from "zod";
import type { StructuredStepParams } from "../../workflow/decision-workflow";
import { anthropicStructuredStep } from "../anthropic/anthropic-structured-step";
import { openaiStructuredStep } from "../openai/openai-structured-step";
import { mockStructuredStep } from "../shared/mock-structured-step";

function chooseProvider(section: string): "anthropic" | "openai" {
  const anthropicSections = new Set([
    "constitution_check",
    "solution_frame",
    "build_direction",
  ]);
  return anthropicSections.has(section) ? "anthropic" : "openai";
}

export async function providerRouting<TSchema extends z.ZodTypeAny>(
  params: StructuredStepParams<TSchema>,
): Promise<z.infer<TSchema>> {
  const shouldUseMock =
    process.env.MOCK_DECISION_PACKET !== "false" ||
    (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY);

  if (shouldUseMock) {
    return mockStructuredStep(params);
  }

  const provider = chooseProvider(params.section);

  if (provider === "anthropic") {
    return anthropicStructuredStep(params);
  }

  return openaiStructuredStep(params);
}

