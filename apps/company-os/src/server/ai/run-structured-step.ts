import { z } from "zod";
import type { StructuredStepParams } from "../../graph/decision-workflow";
import { mockStructuredStep } from "./mock-structured-step";

/**
 * Provider adapter entrypoint.
 *
 * - Default path uses mock output so the UI flow can be demoed immediately.
 * - Replace the TODO branch with Claude/GPT structured-output calls when wiring real models.
 */
export async function runStructuredStep<TSchema extends z.ZodTypeAny>(
  params: StructuredStepParams<TSchema>,
): Promise<z.infer<TSchema>> {
  const shouldUseMock =
    process.env.MOCK_DECISION_PACKET !== "false" ||
    (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY);

  if (shouldUseMock) {
    return mockStructuredStep(params);
  }

  // TODO: Replace with your provider router.
  return mockStructuredStep(params);
}
