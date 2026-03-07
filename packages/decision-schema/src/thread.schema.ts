import { z } from "zod";

export const ThreadTypeSchema = z.enum([
  "company_strategy",
  "new_product",
  "service_addition",
  "go_to_market",
  "legal_policy_change",
  "pricing_change",
  "partnership",
  "other",
]);

export const PacketStatusSchema = z.enum([
  "draft",
  "review_required",
  "approved",
  "rejected",
]);

export const GraphRunStatusSchema = z.enum([
  "running",
  "waiting_human",
  "completed",
  "failed",
]);

export const DecisionThreadMetadataSchema = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  version: z.number().int().positive(),
  status: PacketStatusSchema.default("draft"),
  threadType: ThreadTypeSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().uuid().nullable().optional(),
});

export const DecisionGraphInputPayloadSchema = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid().nullable().optional(),
  threadId: z.string().uuid(),
  threadType: ThreadTypeSchema,
  title: z.string().min(1),
  rawUserInput: z.string().min(1),
  constitutionText: z.string().min(1),
});

export const DecisionGraphSummarySchema = z.object({
  threadId: z.string().uuid(),
  approvalRequired: z.boolean(),
  legalTriggerRequired: z.boolean(),
  blockingIssues: z.array(z.string()).default([]),
  runStatus: GraphRunStatusSchema,
});

export type ThreadType = z.infer<typeof ThreadTypeSchema>;
export type PacketStatus = z.infer<typeof PacketStatusSchema>;
export type GraphRunStatus = z.infer<typeof GraphRunStatusSchema>;
