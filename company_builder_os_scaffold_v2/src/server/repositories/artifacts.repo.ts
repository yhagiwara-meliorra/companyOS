import type { ArtifactType, DecisionPacket } from "../../domain/decision-packet.schema";
import { createServerSupabaseClient } from "../../lib/supabase/server";

function titleForArtifact(type: ArtifactType, packet: DecisionPacket) {
  switch (type) {
    case "prd":
      return `PRD · ${packet.metadata.title}`;
    case "build_plan":
      return `Build Plan · ${packet.metadata.title}`;
    case "gtm_brief":
      return `GTM Brief · ${packet.metadata.title}`;
    case "legal_change_request":
      return `Legal Change Request · ${packet.metadata.title}`;
    case "pricing_memo":
      return `Pricing Memo · ${packet.metadata.title}`;
  }
}

function markdownForArtifact(type: ArtifactType, packet: DecisionPacket) {
  switch (type) {
    case "prd":
      return [
        `# ${titleForArtifact(type, packet)}`,
        ``,
        `## 問題定義`,
        `- 顧客: ${packet.problemFrame.targetCustomer}`,
        `- ユーザー: ${packet.problemFrame.targetUser}`,
        `- コア課題: ${packet.problemFrame.coreProblem}`,
        ``,
        `## MVP`,
        ...packet.mvpScope.inScopeFeatures.map((item) => `- ${item}`),
        ``,
        `## 成功条件`,
        ...packet.mvpScope.successCriteria.map((item) => `- ${item}`),
        ``,
        `## 次アクション`,
        ...packet.execution.nextActions.map((item) => `- ${item}`),
      ].join("\n");
    case "build_plan":
      return [
        `# ${titleForArtifact(type, packet)}`,
        ``,
        `## Stack`,
        `- Frontend: ${packet.buildDirection.recommendedStack.frontend}`,
        `- Backend: ${packet.buildDirection.recommendedStack.backend}`,
        `- Database: ${packet.buildDirection.recommendedStack.database}`,
        `- Orchestration: ${packet.buildDirection.recommendedStack.orchestration}`,
        `- Models: ${packet.buildDirection.recommendedStack.models.join(", ")}`,
        ``,
        `## Agent Plan`,
        ...packet.buildDirection.agentPlan.map((item) => `- ${item}`),
      ].join("\n");
    case "gtm_brief":
      return [
        `# ${titleForArtifact(type, packet)}`,
        ``,
        `## Positioning`,
        packet.gtm.positioning,
        ``,
        `## Value Proposition`,
        packet.gtm.valueProposition,
        ``,
        `## Buyer Persona`,
        ...packet.gtm.buyerPersona.map((item) => `- ${item}`),
      ].join("\n");
    case "legal_change_request":
      return [
        `# ${titleForArtifact(type, packet)}`,
        ``,
        `## Required Contracts`,
        ...packet.riskLegal.requiredContracts.map((item) => `- ${item}`),
        ``,
        `## Required Policies`,
        ...packet.riskLegal.requiredPolicies.map((item) => `- ${item}`),
      ].join("\n");
    case "pricing_memo":
      return [
        `# ${titleForArtifact(type, packet)}`,
        ``,
        `## Pricing Hypothesis`,
        packet.gtm.pricingHypothesis,
        ``,
        `## Cost Impact`,
        `${packet.approval.estimatedCostImpactJPY ?? 0} JPY`,
      ].join("\n");
  }
}

export async function createArtifactRequestAndGenerate(params: {
  organizationId: string;
  threadId: string;
  packetId: string;
  requestedBy?: string | null;
  artifactType: ArtifactType;
  packet: DecisionPacket;
}) {
  const supabase = await createServerSupabaseClient();

  const { data: request, error: requestError } = await supabase
    .from("packet_artifact_requests")
    .upsert({
      decision_packet_id: params.packetId,
      artifact_type: params.artifactType,
      requested_by: params.requestedBy ?? null,
      status: "running",
    })
    .select("*")
    .single();

  if (requestError) throw requestError;

  const title = titleForArtifact(params.artifactType, params.packet);
  const content = markdownForArtifact(params.artifactType, params.packet);

  const { data: artifact, error: artifactError } = await supabase
    .from("artifacts")
    .insert({
      organization_id: params.organizationId,
      thread_id: params.threadId,
      decision_packet_id: params.packetId,
      request_id: request.id,
      artifact_type: params.artifactType,
      title,
      content_markdown: content,
      content_json: params.packet,
      metadata: { generated_from: "decision_packet" },
      status: "completed",
      created_by: params.requestedBy ?? null,
    })
    .select("*")
    .single();

  if (artifactError) throw artifactError;

  const { error: requestCompleteError } = await supabase
    .from("packet_artifact_requests")
    .update({ status: "completed" })
    .eq("id", request.id);
  if (requestCompleteError) throw requestCompleteError;

  return artifact;
}

export async function getArtifactById(artifactId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("artifacts")
    .select("*")
    .eq("id", artifactId)
    .single();
  if (error) throw error;
  return data;
}
