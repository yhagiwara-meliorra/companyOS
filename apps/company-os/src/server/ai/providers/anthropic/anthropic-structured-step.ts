import { z } from "zod";
import type { StructuredStepParams } from "../../../../graph/decision-workflow";
import { parseJsonFromModelText, renderStructuredPrompt } from "../shared/structured-step.utils";

interface AnthropicMessageResponse {
  content?: Array<{ type?: string; text?: string }>;
  error?: { message?: string };
}

export async function anthropicStructuredStep<TSchema extends z.ZodTypeAny>(
  params: StructuredStepParams<TSchema>,
): Promise<z.infer<TSchema>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is missing.");

  const model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: renderStructuredPrompt(params),
        },
      ],
    }),
  });

  const payload = (await res.json()) as AnthropicMessageResponse;
  if (!res.ok) {
    throw new Error(`Anthropic request failed: ${payload.error?.message ?? res.statusText}`);
  }

  const text = payload.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("Anthropic response is empty.");

  const parsed = parseJsonFromModelText(text);
  return params.schema.parse(parsed);
}

