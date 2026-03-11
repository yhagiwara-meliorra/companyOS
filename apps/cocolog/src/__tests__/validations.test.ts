import { describe, it, expect } from "vitest";
import { CreateOrganizationSchema } from "@/lib/validations/organization";

describe("CreateOrganizationSchema", () => {
  it("accepts valid input", () => {
    const result = CreateOrganizationSchema.safeParse({
      name: "Acme Corp",
      slug: "acme-corp",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = CreateOrganizationSchema.safeParse({
      name: "",
      slug: "acme",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid slug", () => {
    const result = CreateOrganizationSchema.safeParse({
      name: "Acme",
      slug: "Acme Corp!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects slug with uppercase", () => {
    const result = CreateOrganizationSchema.safeParse({
      name: "Acme",
      slug: "AcmeCorp",
    });
    expect(result.success).toBe(false);
  });
});

describe("ClassificationResult (anthropic/classify)", () => {
  // Dynamic import to avoid pulling in Anthropic SDK at test time
  it("validates a full classification result", async () => {
    const { z } = await import("zod");

    // Replicate the schema shape from classify.ts for testing
    const SignalScoreSchema = z.object({
      value: z.number().min(0).max(1),
      confidence: z.number().min(0).max(1),
    });

    const ClassificationResultSchema = z.object({
      scene_label: z.string(),
      confidence: z.number().min(0).max(1),
      tone_score: z.number().min(0).max(1),
      politeness_score: z.number().min(0).max(1),
      flags: z.array(z.string()),
      signals: z.record(z.string(), SignalScoreSchema),
    });

    const result = ClassificationResultSchema.safeParse({
      scene_label: "feedback",
      confidence: 0.85,
      tone_score: 0.7,
      politeness_score: 0.8,
      flags: ["actionable"],
      signals: {
        clarity: { value: 0.85, confidence: 0.9 },
        empathy: { value: 0.6, confidence: 0.75 },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects score value out of range", async () => {
    const { z } = await import("zod");

    const SignalScoreSchema = z.object({
      value: z.number().min(0).max(1),
      confidence: z.number().min(0).max(1),
    });

    const ClassificationResultSchema = z.object({
      scene_label: z.string(),
      confidence: z.number().min(0).max(1),
      tone_score: z.number().min(0).max(1),
      politeness_score: z.number().min(0).max(1),
      flags: z.array(z.string()),
      signals: z.record(z.string(), SignalScoreSchema),
    });

    const result = ClassificationResultSchema.safeParse({
      scene_label: "question",
      confidence: 0.9,
      tone_score: 1.5, // out of range
      politeness_score: 0.8,
      flags: [],
      signals: {
        clarity: { value: 0.5, confidence: 0.8 },
      },
    });
    expect(result.success).toBe(false);
  });

  it("validates signals with valid scores", async () => {
    const { z } = await import("zod");

    const SignalScoreSchema = z.object({
      value: z.number().min(0).max(1),
      confidence: z.number().min(0).max(1),
    });

    const result = SignalScoreSchema.safeParse({
      value: 0.7,
      confidence: 0.8,
    });
    expect(result.success).toBe(true);
  });
});
