import { z } from "zod";
import { ApprovalSchema, shouldRequireHumanApproval } from "./approval.schema";
import { ArtifactTypeSchema } from "./artifact.schema";
import { DecisionThreadMetadataSchema, ThreadTypeSchema, type ThreadType } from "./thread.schema";

/**
 * Decision Packet is the canonical business object for one AI CEO thread.
 * It is not a LangGraph state object; it is the durable company record that
 * downstream systems (PRD, build plan, GTM, legal) consume.
 */

export const TShirtRiskSchema = z.enum(["low", "medium", "high"]);
export const FitDecisionSchema = z.enum(["pass", "needs_revision", "fail"]);

export const PrincipleAssessmentSchema = z.object({
  explainableToNextGeneration: z.boolean(),
  reducesExternalities: z.boolean(),
  transparent: z.boolean(),
  empowersIndividuals: z.boolean(),
  scalableToLargeMarket: z.boolean(),
});

export const DecisionPacketSchema = z.object({
  metadata: DecisionThreadMetadataSchema,

  constitutionFit: z.object({
    missionFit: z.string().min(1),
    visionFit: z.string().min(1),
    solveFit: z.string().min(1),
    principles: PrincipleAssessmentSchema,
    misalignmentPoints: z.array(z.string()).default([]),
    constitutionDecision: FitDecisionSchema,
  }),

  problemFrame: z.object({
    targetCustomer: z.string().min(1),
    targetUser: z.string().min(1),
    coreProblem: z.string().min(1),
    currentAlternatives: z.array(z.string()).default([]),
    painLevel: TShirtRiskSchema,
    urgency: TShirtRiskSchema,
    willingnessToPay: TShirtRiskSchema,
    marketHypothesis: z.string().min(1),
    evidence: z.array(z.string()).default([]),
  }),

  worldWhyNow: z.object({
    whyNow: z.string().min(1),
    desiredWorld: z.string().min(1),
    socialImpact: z.string().min(1),
    nonGoals: z.array(z.string()).default([]),
  }),

  solutionFrame: z.object({
    solutionConcept: z.string().min(1),
    aiRole: z.array(z.string()).min(1),
    humanRole: z.array(z.string()).min(1),
    workflowChange: z.string().min(1),
    whyAI: z.string().min(1),
    whyNotAI: z.array(z.string()).default([]),
  }),

  mvpScope: z.object({
    inScopeFeatures: z.array(z.string()).min(1),
    outOfScopeFeatures: z.array(z.string()).default([]),
    successCriteria: z.array(z.string()).min(1),
    initialCustomers: z.array(z.string()).min(1),
    initialKPIs: z.array(z.string()).min(1),
  }),

  buildDirection: z.object({
    recommendedStack: z.object({
      frontend: z.string().min(1),
      backend: z.string().min(1),
      database: z.string().min(1),
      orchestration: z.string().min(1),
      models: z.array(z.string()).min(1),
    }),
    dataRequirements: z.array(z.string()).default([]),
    agentPlan: z.array(z.string()).default([]),
    humanApprovalPoints: z.array(z.string()).default([]),
  }),

  gtm: z.object({
    positioning: z.string().min(1),
    valueProposition: z.string().min(1),
    targetIndustry: z.array(z.string()).default([]),
    buyerPersona: z.array(z.string()).default([]),
    pricingHypothesis: z.string().min(1),
    salesMotion: z.string().min(1),
    marketingAssetsNeeded: z.array(z.string()).default([]),
  }),

  riskLegal: z.object({
    legalRisks: z.array(z.string()).default([]),
    ethicalRisks: z.array(z.string()).default([]),
    marketRisks: z.array(z.string()).default([]),
    implementationRisks: z.array(z.string()).default([]),
    requiredContracts: z.array(z.string()).default([]),
    requiredPolicies: z.array(z.string()).default([]),
    legalTriggerRequired: z.boolean().default(false),
  }),

  approval: ApprovalSchema,

  execution: z.object({
    nextActions: z.array(z.string()).min(1),
    owners: z.array(z.string()).default([]),
    dueDates: z.array(z.string()).default([]),
    artifactRequests: z.array(ArtifactTypeSchema).default([]),
  }),
});

export type DecisionPacket = z.infer<typeof DecisionPacketSchema>;
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

export { ThreadTypeSchema, shouldRequireHumanApproval };

export function deriveDefaultArtifactRequests(packet: Pick<DecisionPacket, "approval" | "riskLegal">): ArtifactType[] {
  const outputs: ArtifactType[] = ["prd", "build_plan", "gtm_brief"];

  if (packet.riskLegal.legalTriggerRequired) {
    outputs.push("legal_change_request");
  }

  if ((packet.approval.estimatedCostImpactJPY ?? 0) >= 100_000) {
    outputs.push("pricing_memo");
  }

  return outputs;
}

export function emptyDecisionPacket(params: {
  id: string;
  threadId: string;
  threadType: ThreadType;
  title: string;
  nowIso: string;
  createdBy?: string | null;
}): DecisionPacket {
  return {
    metadata: {
      id: params.id,
      threadId: params.threadId,
      version: 1,
      status: "draft",
      threadType: params.threadType,
      title: params.title,
      summary: "",
      createdAt: params.nowIso,
      updatedAt: params.nowIso,
      createdBy: params.createdBy ?? null,
    },
    constitutionFit: {
      missionFit: "",
      visionFit: "",
      solveFit: "",
      principles: {
        explainableToNextGeneration: false,
        reducesExternalities: false,
        transparent: false,
        empowersIndividuals: false,
        scalableToLargeMarket: false,
      },
      misalignmentPoints: [],
      constitutionDecision: "needs_revision",
    },
    problemFrame: {
      targetCustomer: "",
      targetUser: "",
      coreProblem: "",
      currentAlternatives: [],
      painLevel: "medium",
      urgency: "medium",
      willingnessToPay: "medium",
      marketHypothesis: "",
      evidence: [],
    },
    worldWhyNow: {
      whyNow: "",
      desiredWorld: "",
      socialImpact: "",
      nonGoals: [],
    },
    solutionFrame: {
      solutionConcept: "",
      aiRole: [],
      humanRole: [],
      workflowChange: "",
      whyAI: "",
      whyNotAI: [],
    },
    mvpScope: {
      inScopeFeatures: [],
      outOfScopeFeatures: [],
      successCriteria: [],
      initialCustomers: [],
      initialKPIs: [],
    },
    buildDirection: {
      recommendedStack: {
        frontend: "",
        backend: "",
        database: "",
        orchestration: "",
        models: [],
      },
      dataRequirements: [],
      agentPlan: [],
      humanApprovalPoints: [],
    },
    gtm: {
      positioning: "",
      valueProposition: "",
      targetIndustry: [],
      buyerPersona: [],
      pricingHypothesis: "",
      salesMotion: "",
      marketingAssetsNeeded: [],
    },
    riskLegal: {
      legalRisks: [],
      ethicalRisks: [],
      marketRisks: [],
      implementationRisks: [],
      requiredContracts: [],
      requiredPolicies: [],
      legalTriggerRequired: false,
    },
    approval: {
      approvalRequired: false,
      approvalReasons: [],
      estimatedCostImpactJPY: null,
      changesCeoAiDesign: false,
      finalDecision: "hold",
      decisionReason: "",
    },
    execution: {
      nextActions: [],
      owners: [],
      dueDates: [],
      artifactRequests: [],
    },
  };
}

