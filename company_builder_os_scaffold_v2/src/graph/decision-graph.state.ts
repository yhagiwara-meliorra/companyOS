import {
  MessagesValue,
  ReducedValue,
  StateSchema,
} from "@langchain/langgraph";
import { z } from "zod";
import {
  ArtifactTypeSchema,
  DecisionPacketSchema,
  ThreadTypeSchema,
} from "../domain/decision-packet.schema";

const uniqueConcat = (left: string[], right: string[]) => {
  const next = new Set([...(left ?? []), ...(right ?? [])]);
  return Array.from(next);
};

const uniqueArtifactConcat = (
  left: Array<z.infer<typeof ArtifactTypeSchema>>,
  right: Array<z.infer<typeof ArtifactTypeSchema>>,
) => {
  const next = new Set([...(left ?? []), ...(right ?? [])]);
  return Array.from(next) as Array<z.infer<typeof ArtifactTypeSchema>>;
};

/**
 * External input from Next.js into the graph.
 * Keep it thin: raw text + stable metadata.
 */
export const DecisionGraphInputSchema = new StateSchema({
  orgId: z.string().uuid(),
  userId: z.string().uuid().nullable().optional(),
  threadId: z.string().uuid(),
  threadType: ThreadTypeSchema,
  title: z.string().min(1),
  rawUserInput: z.string().min(1),
  constitutionText: z.string().min(1),
  messages: MessagesValue,
});

/**
 * Internal graph state. This is broader than the input/output and exists only
 * to coordinate nodes inside LangGraph.
 */
export const DecisionGraphState = new StateSchema({
  orgId: z.string().uuid(),
  userId: z.string().uuid().nullable().optional(),
  threadId: z.string().uuid(),
  threadType: ThreadTypeSchema,
  title: z.string().min(1),
  rawUserInput: z.string().min(1),
  constitutionText: z.string().min(1),
  messages: MessagesValue,

  problemDraft: z.record(z.string(), z.unknown()).optional(),
  worldDraft: z.record(z.string(), z.unknown()).optional(),
  solutionDraft: z.record(z.string(), z.unknown()).optional(),
  mvpDraft: z.record(z.string(), z.unknown()).optional(),
  buildDraft: z.record(z.string(), z.unknown()).optional(),
  gtmDraft: z.record(z.string(), z.unknown()).optional(),
  riskDraft: z.record(z.string(), z.unknown()).optional(),
  legalImpactDraft: z.record(z.string(), z.unknown()).optional(),
  approvalDraft: z.record(z.string(), z.unknown()).optional(),

  blockingIssues: new ReducedValue(z.array(z.string()).default([]), {
    reducer: uniqueConcat,
  }),

  reviewNotes: new ReducedValue(z.array(z.string()).default([]), {
    reducer: uniqueConcat,
  }),

  artifactRequests: new ReducedValue(
    z.array(ArtifactTypeSchema).default([]),
    { reducer: uniqueArtifactConcat },
  ),

  approvalRequired: z.boolean().default(false),
  legalTriggerRequired: z.boolean().default(false),
  runStatus: z
    .enum(["running", "waiting_human", "completed", "failed"])
    .default("running"),

  decisionPacket: DecisionPacketSchema.optional(),
});

/**
 * Narrow output to exactly what Next.js / Supabase need after the graph run.
 */
export const DecisionGraphOutputSchema = new StateSchema({
  threadId: z.string().uuid(),
  decisionPacket: DecisionPacketSchema,
  approvalRequired: z.boolean(),
  legalTriggerRequired: z.boolean(),
  artifactRequests: z.array(ArtifactTypeSchema),
  blockingIssues: z.array(z.string()),
  runStatus: z.enum(["completed", "waiting_human", "failed"]),
});

export type DecisionGraphInput = typeof DecisionGraphInputSchema.State;
export type DecisionGraphStateValue = typeof DecisionGraphState.State;
export type DecisionGraphUpdate = typeof DecisionGraphState.Update;
export type DecisionGraphOutput = typeof DecisionGraphOutputSchema.State;
