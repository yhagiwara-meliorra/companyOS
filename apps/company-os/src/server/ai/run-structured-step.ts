import { z } from "zod";
import type { StructuredStepParams } from "../../graph/decision-workflow";
import { mockStructuredStep } from "./mock-structured-step";
import { providerRouting } from "./providers/routing/provider-routing";

/**
 * Provider adapter entrypoint.
 *
 * - Default path uses mock output so the UI flow can be demoed immediately.
 * - Replace the TODO branch with Claude/GPT structured-output calls when wiring real models.
 */
export async function runStructuredStep<TSchema extends z.ZodTypeAny>(
  params: StructuredStepParams<TSchema>,
): Promise<z.infer<TSchema>> {
  const shouldUseMock = process.env.MOCK_DECISION_PACKET === "true";

  if (shouldUseMock) {
    return mockStructuredStep(params);
  }

  return providerRouting(params);
}
