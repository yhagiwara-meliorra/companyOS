import { Command } from "@langchain/langgraph";
import { DecisionPacketSchema, type ArtifactType, type DecisionPacket } from "../../../decision-schema/src/decision-packet.schema";
import { createDecisionWorkflow } from "../decision-workflow";
import { runStructuredStep } from "../../providers/run-structured-step";
import { createPendingApproval } from "../../../../apps/company-os/src/server/repositories/approvals.repo";
import { createArtifactRequestAndGenerate } from "../../../../apps/company-os/src/server/repositories/artifacts.repo";
import { upsertDecisionPacket, getDecisionPacketById } from "../../../../apps/company-os/src/server/repositories/decision-packets.repo";
import { createGraphRun, finishGraphRun } from "../../../../apps/company-os/src/server/repositories/graph-runs.repo";
import { addAssistantMessage, getThreadById, getThreadMessages, setThreadStatus } from "../../../../apps/company-os/src/server/repositories/threads.repo";

const globalState = globalThis as typeof globalThis & {
  __companyBuilderDecisionGraph?: ReturnType<typeof createDecisionWorkflow>;
};

function getDecisionGraph() {
  if (!globalState.__companyBuilderDecisionGraph) {
    globalState.__companyBuilderDecisionGraph = createDecisionWorkflow({
      runStructuredStep,
      saveDecisionPacket: async (packet) => {
        const thread = await getThreadById(packet.metadata.threadId);
        await upsertDecisionPacket(packet, thread.organization_id);
      },
      onArtifactRequests: async () => undefined,
    });
  }
  return globalState.__companyBuilderDecisionGraph;
}

async function fanoutArtifacts(packet: DecisionPacket, artifactTypes: ArtifactType[], organizationId: string) {
  const created = [] as { id: string; artifactType: ArtifactType }[];
  for (const artifactType of artifactTypes) {
    const artifact = await createArtifactRequestAndGenerate({
      organizationId,
      threadId: packet.metadata.threadId,
      packetId: packet.metadata.id,
      artifactType,
      packet,
    });
    created.push({ id: artifact.id, artifactType });
  }
  return created;
}

export async function runDecisionPacketForThread(threadId: string) {
  const thread = await getThreadById(threadId);
  const messages = await getThreadMessages(threadId);
  const graph = getDecisionGraph();
  const graphRun = await createGraphRun(threadId);

  try {
    const result = await graph.invoke(
      {
        orgId: thread.organization_id,
        userId: thread.created_by,
        threadId: thread.id,
        threadType: thread.thread_type,
        title: thread.title,
        rawUserInput: thread.raw_user_input,
        constitutionText: thread.constitution_snapshot,
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
      },
      { configurable: { thread_id: thread.langgraph_thread_id } },
    ) as any;

    const packet = DecisionPacketSchema.parse(result.decisionPacket);
    await upsertDecisionPacket(packet, thread.organization_id);
    await addAssistantMessage(threadId, packet.metadata.summary);

    if (result.__interrupt__?.length) {
      await createPendingApproval({
        organizationId: thread.organization_id,
        threadId,
        decisionPacketId: packet.metadata.id,
        reasons: packet.approval.approvalReasons,
        requestedBy: thread.created_by,
      });
      await setThreadStatus(threadId, "in_review");
      await finishGraphRun(graphRun.id, { status: "waiting_human", decisionPacketId: packet.metadata.id });
      return {
        packetId: packet.metadata.id,
        status: "review_required" as const,
        interruptPayload: result.__interrupt__,
      };
    }

    const artifacts = await fanoutArtifacts(packet, result.artifactRequests ?? packet.execution.artifactRequests ?? [], thread.organization_id);
    await setThreadStatus(threadId, packet.approval.finalDecision === "reject" ? "rejected" : "approved");
    await finishGraphRun(graphRun.id, { status: "completed", decisionPacketId: packet.metadata.id });

    return {
      packetId: packet.metadata.id,
      status: "completed" as const,
      artifacts,
    };
  } catch (error) {
    await finishGraphRun(graphRun.id, { status: "failed", errorMessage: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export async function resumeDecisionPacketReview(params: {
  packetId: string;
  approvalId: string;
  reviewAction: "approve" | "reject" | "edit";
  reviewComment?: string | null;
  editedPacketJson?: string | null;
}) {
  const packetRow = await getDecisionPacketById(params.packetId);
  const thread = await getThreadById(packetRow.thread_id);
  const graph = getDecisionGraph();

  const resumeValue = (() => {
    if (params.reviewAction === "reject") {
      return { approved: false, reason: params.reviewComment ?? "Human reviewer rejected the packet." };
    }

    if (params.reviewAction === "edit") {
      const editedPacket = DecisionPacketSchema.parse(JSON.parse(params.editedPacketJson ?? JSON.stringify(packetRow.packet_json)));
      return { approved: true, editedPacket };
    }

    return { approved: true };
  })();

  const result = await graph.invoke(
    new Command({ resume: resumeValue }),
    { configurable: { thread_id: thread.langgraph_thread_id } },
  ) as any;

  const packet = DecisionPacketSchema.parse(result.decisionPacket ?? packetRow.packet_json);
  await upsertDecisionPacket(packet, thread.organization_id);

  if (params.reviewAction === "reject") {
    await setThreadStatus(thread.id, "rejected");
    return { packetId: packet.metadata.id, status: "rejected" as const };
  }

  const artifacts = await fanoutArtifacts(packet, result.artifactRequests ?? packet.execution.artifactRequests ?? [], thread.organization_id);
  await setThreadStatus(thread.id, packet.approval.finalDecision === "reject" ? "rejected" : "approved");

  return {
    packetId: packet.metadata.id,
    status: "approved" as const,
    artifacts,
  };
}
