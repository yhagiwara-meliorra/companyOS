import { PrdArtifactSchema, PrdArtifact } from "./prd.schema";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

/**
 * Decision Packet 型は decision-schema package を参照する想定
 */
type DecisionPacket = any;

export function generatePrd(packet: DecisionPacket): {
  json: PrdArtifact;
  markdown: string;
} {

  const prd: PrdArtifact = {
    id: uuidv4(),
    packetId: packet.metadata.id,
    version: 1,

    title: packet.metadata.title,
    summary: packet.metadata.summary,

    overview: packet.solutionFrame.solutionConcept,

    problem: {
      user: packet.problemFrame.targetUser,
      pain: packet.problemFrame.coreProblem,
      alternatives: packet.problemFrame.currentAlternatives,
      whyExistingFails: packet.problemFrame.marketHypothesis
    },

    targetUsers: {
      primary: [packet.problemFrame.targetUser],
      secondary: [],
      buyer: packet.gtm.buyerPersona ?? [],
      approver: []
    },

    whyNow: {
      timing: packet.worldWhyNow.whyNow,
      marketWindow: "",
      strategicFit: packet.worldWhyNow.desiredWorld
    },

    productConcept: {
      oneLiner: packet.solutionFrame.solutionConcept,
      aiRole: packet.solutionFrame.aiRole,
      humanRole: packet.solutionFrame.humanRole,
      valueLoop: packet.solutionFrame.workflowChange
    },

    workflows: [
      {
        name: "Strategy exploration",
        actor: packet.problemFrame.targetUser,
        steps: [
          "Create new thread",
          "Discuss with AI CEO",
          "Generate Decision Packet",
          "Generate PRD"
        ]
      }
    ],

    mvpScope: {
      inScope: packet.mvpScope.inScopeFeatures,
      outOfScope: packet.mvpScope.outOfScopeFeatures
    },

    functionalRequirements: packet.mvpScope.inScopeFeatures.map(
      (f: string, i: number) => ({
        id: `FR-${i + 1}`,
        title: f,
        description: f,
        priority: "must"
      })
    ),

    approvalPoints: packet.buildDirection.humanApprovalPoints,

    dataRequirements: packet.buildDirection.dataRequirements,

    risks: {
      legal: packet.riskLegal.legalRisks,
      ethical: packet.riskLegal.ethicalRisks,
      technical: packet.riskLegal.implementationRisks,
      market: packet.riskLegal.marketRisks
    },

    successMetrics: packet.mvpScope.initialKPIs,

    openQuestions: [],

    nextSteps: packet.execution.nextActions
  };

  const validated = PrdArtifactSchema.parse(prd);

  const markdown = renderMarkdown(validated);

  return {
    json: validated,
    markdown
  };
}

function renderMarkdown(prd: PrdArtifact) {
  const templatePath = path.join(__dirname, "prd.template.md");
  let template = fs.readFileSync(templatePath, "utf-8");

  const replace = (key: string, value: any) => {
    const text = Array.isArray(value) ? value.join("\n- ") : value;
    template = template.replace(
      `{{${key}}}`,
      Array.isArray(value) ? "- " + text : text
    );
  };

  Object.entries(prd).forEach(([k, v]) => {
    if (typeof v !== "object") replace(k, v);
  });

  return template;
}