import { z } from "zod";
import type { StructuredStepParams } from "../../workflow/decision-workflow";
import { mockStructuredStep } from "../shared/mock-structured-step";

/**
 * Anthropic adapter placeholder.
 * Replace this with real Claude structured-output calls when SDK wiring is added.
 */
export async function anthropicStructuredStep<TSchema extends z.ZodTypeAny>(
  params: StructuredStepParams<TSchema>,
): Promise<z.infer<TSchema>> {
  return mockStructuredStep(params);
}

