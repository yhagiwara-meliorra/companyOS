import {
  END,
  START,
  MemorySaver,
  StateGraph,
  GraphNode,
  ConditionalEdgeRouter,
} from "@langchain/langgraph";
import { z } from "zod";
import {
  DecisionPacket,
  DecisionPacketSchema,
  ArtifactType,
  deriveDefaultArtifactRequests,
  shouldRequireHumanApproval,
} from "../../decision-schema/src/decision-packet.schema";
import {
  DecisionGraphInputSchema,
  DecisionGraphOutputSchema,
  DecisionGraphState,
} from "./decision-graph.state";
import {
  BuildDraftSchema,
  GtmDraftSchema,
  MvpDraftSchema,
  ProblemDraftSchema,
  RiskDraftSchema,
  SolutionDraftSchema,
  WorldDraftSchema,
} from "./nodes/draft.schemas";
import { afterApprovalRouter } from "./routing/after-approval.router";
import { requestDecisionPacketReview } from "./interrupts/review.interrupt";

export interface StructuredStepParams<TSchema extends z.ZodTypeAny> {
  section: string;
  system: string;
  user: string;
  schema: TSchema;
}

export interface DecisionWorkflowDeps {
  runStructuredStep<TSchema extends z.ZodTypeAny>(
    params: StructuredStepParams<TSchema>,
  ): Promise<z.infer<TSchema>>;
  saveDecisionPacket?(packet: DecisionPacket): Promise<void>;
  onArtifactRequests?(params: { threadId: string; artifactTypes: ArtifactType[] }): Promise<void>;
}

type State = typeof DecisionGraphState.State;

function renderBaseContext(state: State): string {
  return [
    `Thread type: ${state.threadType}`,
    `Title: ${state.title}`,
    `Raw user input:\n${state.rawUserInput}`,
    `Constitution:\n${state.constitutionText}`,
  ].join("\n\n");
}

export function createDecisionWorkflow(deps: DecisionWorkflowDeps) {
  const constitutionCheckNode: GraphNode<typeof DecisionGraphState> = async (state) => {
    const draft = await deps.runStructuredStep({
      section: "constitution_check",
      system:
        "You are AI CEO. Check whether the proposal fits the company constitution. Return only structured data.",
      user: `${renderBaseContext(state)}\n\nReturn mission fit, vision fit, solve fit, principle booleans, misalignment points, and constitutionDecision.`,
      schema: WorldDraftSchema,
    });

    const blockingIssues = draft.constitutionDecision === "fail"
      ? ["憲法整合性に失敗しているため、次の工程に進めない"]
      : draft.misalignmentPoints;

    return {
      worldDraft: draft,
      blockingIssues,
    };
  };

  const problemFrameNode: GraphNode<typeof DecisionGraphState> = async (state) => {
    const draft = await deps.runStructuredStep({
      section: "problem_frame",
      system:
        "You are AI CEO. Identify the customer, user, pain, urgency, willingness to pay, and alternatives.",
      user: `${renderBaseContext(state)}\n\nUse the constitution and thread context.`,
      schema: ProblemDraftSchema,
    });

    return { problemDraft: draft };
  };

  const solutionFrameNode: GraphNode<typeof DecisionGraphState> = async (state) => {
    const draft = await deps.runStructuredStep({
      section: "solution_frame",
      system:
        "You are AI CEO. Describe the solution concept, AI role, human role, workflow change, and why AI is justified.",
      user: `${renderBaseContext(state)}\n\nProblem draft:\n${JSON.stringify(state.problemDraft, null, 2)}\n\nWorld draft:\n${JSON.stringify(state.worldDraft, null, 2)}`,
      schema: SolutionDraftSchema,
    });

    return { solutionDraft: draft };
  };

  const mvpCutNode: GraphNode<typeof DecisionGraphState> = async (state) => {
    const draft = await deps.runStructuredStep({
      section: "mvp_cut",
      system:
        "You are AI CEO. Cut scope aggressively and define only the minimum features and success criteria.",
      user: `${renderBaseContext(state)}\n\nSolution draft:\n${JSON.stringify(state.solutionDraft, null, 2)}`,
      schema: MvpDraftSchema,
    });

    return { mvpDraft: draft };
  };

  const buildDirectionNode: GraphNode<typeof DecisionGraphState> = async (state) => {
    const draft = await deps.runStructuredStep({
      section: "build_direction",
      system:
        "You are AI Architect. Recommend stack, data requirements, agent plan, and human approval points for Next.js + Supabase + LangGraph.",
      user: `${renderBaseContext(state)}\n\nMVP draft:\n${JSON.stringify(state.mvpDraft, null, 2)}`,
      schema: BuildDraftSchema,
    });

    return { buildDraft: draft };
  };

  const gtmFrameNode: GraphNode<typeof DecisionGraphState> = async (state) => {
    const draft = await deps.runStructuredStep({
      section: "gtm_frame",
      system:
        "You are AI Growth Lead. Produce positioning, value proposition, buyer persona, pricing hypothesis, and required marketing assets.",
      user: `${renderBaseContext(state)}\n\nProblem draft:\n${JSON.stringify(state.problemDraft, null, 2)}\n\nMVP draft:\n${JSON.stringify(state.mvpDraft, null, 2)}`,
      schema: GtmDraftSchema,
    });

    return { gtmDraft: draft };
  };

  const riskAndDecisionNode: GraphNode<typeof DecisionGraphState> = async (state) => {
    const draft = await deps.runStructuredStep({
      section: "risk_and_decision",
      system:
        "You are AI CEO with AI Legal. Identify legal, ethical, market, and implementation risks. Decide whether to go, hold, or reject.",
      user: `${renderBaseContext(state)}\n\nBuild draft:\n${JSON.stringify(state.buildDraft, null, 2)}\n\nGTM draft:\n${JSON.stringify(state.gtmDraft, null, 2)}`,
      schema: RiskDraftSchema,
    });

    const approval = shouldRequireHumanApproval({
      estimatedCostImpactJPY: draft.estimatedCostImpactJPY,
      changesCeoAiDesign: draft.changesCeoAiDesign,
      legalTriggerRequired: draft.legalTriggerRequired,
    });

    const packet: DecisionPacket = DecisionPacketSchema.parse({
      metadata: {
        id: crypto.randomUUID(),
        threadId: state.threadId,
        version: 1,
        status: approval.required ? "review_required" : "draft",
        threadType: state.threadType,
        title: state.title,
        summary: draft.decisionReason,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: state.userId ?? null,
      },
      constitutionFit: {
        missionFit: state.worldDraft?.missionFit ?? "",
        visionFit: state.worldDraft?.visionFit ?? "",
        solveFit: state.worldDraft?.solveFit ?? "",
        principles: state.worldDraft?.principles,
        misalignmentPoints: state.worldDraft?.misalignmentPoints ?? [],
        constitutionDecision: state.worldDraft?.constitutionDecision ?? "needs_revision",
      },
      problemFrame: state.problemDraft,
      worldWhyNow: {
        whyNow: state.worldDraft?.whyNow ?? "",
        desiredWorld: state.worldDraft?.desiredWorld ?? "",
        socialImpact: state.worldDraft?.socialImpact ?? "",
        nonGoals: state.worldDraft?.nonGoals ?? [],
      },
      solutionFrame: state.solutionDraft,
      mvpScope: state.mvpDraft,
      buildDirection: state.buildDraft,
      gtm: state.gtmDraft,
      riskLegal: {
        legalRisks: draft.legalRisks,
        ethicalRisks: draft.ethicalRisks,
        marketRisks: draft.marketRisks,
        implementationRisks: draft.implementationRisks,
        requiredContracts: draft.requiredContracts,
        requiredPolicies: draft.requiredPolicies,
        legalTriggerRequired: draft.legalTriggerRequired,
      },
      approval: {
        approvalRequired: approval.required,
        approvalReasons: approval.reasons,
        estimatedCostImpactJPY: draft.estimatedCostImpactJPY,
        changesCeoAiDesign: draft.changesCeoAiDesign,
        finalDecision: draft.finalDecision,
        decisionReason: draft.decisionReason,
      },
      execution: {
        nextActions: draft.nextActions,
        owners: draft.owners,
        dueDates: draft.dueDates,
        artifactRequests: [],
      },
    });

    return {
      riskDraft: draft,
      decisionPacket: packet,
      approvalRequired: approval.required,
      legalTriggerRequired: draft.legalTriggerRequired,
      artifactRequests: deriveDefaultArtifactRequests(packet),
    };
  };

  const approvalGateNode: GraphNode<typeof DecisionGraphState> = async (state) => {
    if (!state.decisionPacket) {
      return {
        runStatus: "failed",
        blockingIssues: ["Decision Packet が存在しないため承認へ進めない"],
      };
    }

    if (!state.approvalRequired) {
      return { runStatus: "running" };
    }

    const review = requestDecisionPacketReview({
      threadId: state.threadId,
      title: state.title,
      packet: state.decisionPacket,
      reasons: state.decisionPacket.approval.approvalReasons,
    });

    if (!review.approved) {
      return {
        runStatus: "failed",
        blockingIssues: [review.reason || "人間承認で却下された"],
      };
    }

    return {
      decisionPacket: review.editedPacket ?? state.decisionPacket,
      runStatus: "running",
    };
  };

  const afterApprovalEdgeRouter: ConditionalEdgeRouter<
    typeof DecisionGraphState,
    "persistDecisionPacket"
  > = (state) => afterApprovalRouter(state);

  const persistDecisionPacketNode: GraphNode<typeof DecisionGraphState> = async (state) => {
    if (!state.decisionPacket) {
      return {
        runStatus: "failed",
        blockingIssues: ["Decision Packet が存在しないため保存できない"],
      };
    }

    await deps.saveDecisionPacket?.(state.decisionPacket);

    return {
      decisionPacket: {
        ...state.decisionPacket,
        metadata: {
          ...state.decisionPacket.metadata,
          status:
            state.decisionPacket.approval.finalDecision === "reject"
              ? "rejected"
              : "approved",
          updatedAt: new Date().toISOString(),
        },
      },
      runStatus: "completed",
    };
  };

  const fanoutArtifactsNode: GraphNode<typeof DecisionGraphState> = async (state) => {
    await deps.onArtifactRequests?.({
      threadId: state.threadId,
      artifactTypes: state.artifactRequests,
    });

    if (!state.decisionPacket) {
      return {};
    }

    return {
      decisionPacket: {
        ...state.decisionPacket,
        execution: {
          ...state.decisionPacket.execution,
          artifactRequests: state.artifactRequests,
        },
      },
    };
  };

  const checkpointer = new MemorySaver();

  return new StateGraph({
    state: DecisionGraphState,
    input: DecisionGraphInputSchema,
    output: DecisionGraphOutputSchema,
  })
    .addNode("constitutionCheck", constitutionCheckNode)
    .addNode("problemFrame", problemFrameNode)
    .addNode("solutionFrame", solutionFrameNode)
    .addNode("mvpCut", mvpCutNode)
    .addNode("buildDirection", buildDirectionNode)
    .addNode("gtmFrame", gtmFrameNode)
    .addNode("riskAndDecision", riskAndDecisionNode)
    .addNode("approvalGate", approvalGateNode)
    .addNode("persistDecisionPacket", persistDecisionPacketNode)
    .addNode("fanoutArtifacts", fanoutArtifactsNode)
    .addEdge(START, "constitutionCheck")
    .addEdge("constitutionCheck", "problemFrame")
    .addEdge("problemFrame", "solutionFrame")
    .addEdge("solutionFrame", "mvpCut")
    .addEdge("mvpCut", "buildDirection")
    .addEdge("buildDirection", "gtmFrame")
    .addEdge("gtmFrame", "riskAndDecision")
    .addEdge("riskAndDecision", "approvalGate")
    .addConditionalEdges("approvalGate", afterApprovalEdgeRouter, ["persistDecisionPacket", END])
    .addEdge("persistDecisionPacket", "fanoutArtifacts")
    .addEdge("fanoutArtifacts", END)
    .compile({ checkpointer });
}

