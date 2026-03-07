import { z } from "zod";
import type { StructuredStepParams } from "../workflow/decision-workflow";
import { providerRouting } from "./routing/provider-routing";

/**
 * Provider adapter entrypoint.
 */
export async function runStructuredStep<TSchema extends z.ZodTypeAny>(
  params: StructuredStepParams<TSchema>,
): Promise<z.infer<TSchema>> {
  return providerRouting(params);
}

