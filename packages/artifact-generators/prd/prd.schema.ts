import { z } from "zod";

export const WorkflowSchema = z.object({
  name: z.string(),
  actor: z.string(),
  steps: z.array(z.string())
});

export const FunctionalRequirementSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(["must", "should", "could"])
});

export const PrdArtifactSchema = z.object({
  id: z.string(),
  packetId: z.string(),
  version: z.number(),

  title: z.string(),
  summary: z.string(),

  overview: z.string(),

  problem: z.object({
    user: z.string(),
    pain: z.string(),
    alternatives: z.array(z.string()),
    whyExistingFails: z.string()
  }),

  targetUsers: z.object({
    primary: z.array(z.string()),
    secondary: z.array(z.string()),
    buyer: z.array(z.string()),
    approver: z.array(z.string())
  }),

  whyNow: z.object({
    timing: z.string(),
    marketWindow: z.string(),
    strategicFit: z.string()
  }),

  productConcept: z.object({
    oneLiner: z.string(),
    aiRole: z.array(z.string()),
    humanRole: z.array(z.string()),
    valueLoop: z.string()
  }),

  workflows: z.array(WorkflowSchema),

  mvpScope: z.object({
    inScope: z.array(z.string()),
    outOfScope: z.array(z.string())
  }),

  functionalRequirements: z.array(FunctionalRequirementSchema),

  approvalPoints: z.array(z.string>(),

  dataRequirements: z.array(z.string()),

  risks: z.object({
    legal: z.array(z.string()),
    ethical: z.array(z.string()),
    technical: z.array(z.string()),
    market: z.array(z.string())
  }),

  successMetrics: z.array(z.string()),

  openQuestions: z.array(z.string()),

  nextSteps: z.array(z.string())
});

export type PrdArtifact = z.infer<typeof PrdArtifactSchema>;