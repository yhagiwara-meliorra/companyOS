import { z } from "zod";

export const ArtifactTypeSchema = z.enum([
  "prd",
  "build_plan",
  "gtm_brief",
  "legal_change_request",
  "pricing_memo",
]);

export const ArtifactRequestSchema = z.object({
  nextActions: z.array(z.string()).min(1),
  owners: z.array(z.string()).default([]),
  dueDates: z.array(z.string()).default([]),
  artifactRequests: z.array(ArtifactTypeSchema).default([]),
});

export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

