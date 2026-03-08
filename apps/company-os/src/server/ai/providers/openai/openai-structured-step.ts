import { z } from "zod";
import type { StructuredStepParams } from "../../../../graph/decision-workflow";
import { parseJsonFromModelText, renderStructuredPrompt } from "../shared/structured-step.utils";

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: { message?: string };
}

export async function openaiStructuredStep<TSchema extends z.ZodTypeAny>(
  params: StructuredStepParams<TSchema>,
): Promise<z.infer<TSchema>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing.");

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You output strictly valid JSON only." },
        { role: "user", content: renderStructuredPrompt(params) },
      ],
    }),
  });

  const payload = (await res.json()) as OpenAIChatResponse;
  if (!res.ok) {
    throw new Error(`OpenAI request failed: ${payload.error?.message ?? res.statusText}`);
  }

  const text = payload.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI response is empty.");

  const parsed = parseJsonFromModelText(text);
  return params.schema.parse(parsed);
}

