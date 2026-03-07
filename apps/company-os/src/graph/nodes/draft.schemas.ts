import { z } from "zod";

export const ProblemDraftSchema = z.object({
  targetCustomer: z.string(),
  targetUser: z.string(),
  coreProblem: z.string(),
  currentAlternatives: z.array(z.string()).default([]),
  painLevel: z.enum(["low", "medium", "high"]),
  urgency: z.enum(["low", "medium", "high"]),
  willingnessToPay: z.enum(["low", "medium", "high"]),
  marketHypothesis: z.string(),
  evidence: z.array(z.string()).default([]),
});

export const WorldDraftSchema = z.object({
  missionFit: z.string(),
  visionFit: z.string(),
  solveFit: z.string(),
  desiredWorld: z.string(),
  socialImpact: z.string(),
  whyNow: z.string(),
  nonGoals: z.array(z.string()).default([]),
  principles: z.object({
    explainableToNextGeneration: z.boolean(),
    reducesExternalities: z.boolean(),
    transparent: z.boolean(),
    empowersIndividuals: z.boolean(),
    scalableToLargeMarket: z.boolean(),
  }),
  misalignmentPoints: z.array(z.string()).default([]),
  constitutionDecision: z.enum(["pass", "needs_revision", "fail"]),
});

export const SolutionDraftSchema = z.object({
  solutionConcept: z.string(),
  aiRole: z.array(z.string()).default([]),
  humanRole: z.array(z.string()).default([]),
  workflowChange: z.string(),
  whyAI: z.string(),
  whyNotAI: z.array(z.string()).default([]),
});

export const MvpDraftSchema = z.object({
  inScopeFeatures: z.array(z.string()).default([]),
  outOfScopeFeatures: z.array(z.string()).default([]),
  successCriteria: z.array(z.string()).default([]),
  initialCustomers: z.array(z.string()).default([]),
  initialKPIs: z.array(z.string()).default([]),
});

export const BuildDraftSchema = z.object({
  recommendedStack: z.object({
    frontend: z.string(),
    backend: z.string(),
    database: z.string(),
    orchestration: z.string(),
    models: z.array(z.string()).default([]),
  }),
  dataRequirements: z.array(z.string()).default([]),
  agentPlan: z.array(z.string()).default([]),
  humanApprovalPoints: z.array(z.string()).default([]),
});

export const GtmDraftSchema = z.object({
  positioning: z.string(),
  valueProposition: z.string(),
  targetIndustry: z.array(z.string()).default([]),
  buyerPersona: z.array(z.string()).default([]),
  pricingHypothesis: z.string(),
  salesMotion: z.string(),
  marketingAssetsNeeded: z.array(z.string()).default([]),
});

export const RiskDraftSchema = z.object({
  legalRisks: z.array(z.string()).default([]),
  ethicalRisks: z.array(z.string()).default([]),
  marketRisks: z.array(z.string()).default([]),
  implementationRisks: z.array(z.string()).default([]),
  requiredContracts: z.array(z.string()).default([]),
  requiredPolicies: z.array(z.string()).default([]),
  legalTriggerRequired: z.boolean().default(false),
  estimatedCostImpactJPY: z.number().int().nullable().default(null),
  changesCeoAiDesign: z.boolean().default(false),
  finalDecision: z.enum(["go", "hold", "reject"]),
  decisionReason: z.string(),
  nextActions: z.array(z.string()).default([]),
  owners: z.array(z.string()).default([]),
  dueDates: z.array(z.string()).default([]),
});

